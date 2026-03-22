/**
 * 会員ポータル用予約 API（自分の予約のみ操作可能）
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { reservations, lessonSlots, lessons, substitutionCredits } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { requireMember } from '@/lib/api-auth';
import { notifyReservationConfirmed } from '@/lib/notifications';

export async function GET(_req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;

  const rows = await db
    .select({
      id: reservations.id,
      status: reservations.status,
      isSubstitution: reservations.isSubstitution,
      createdAt: reservations.createdAt,
      date: lessonSlots.date,
      startTime: lessonSlots.startTime,
      endTime: lessonSlots.endTime,
      lessonTitle: lessons.title,
    })
    .from(reservations)
    .innerJoin(lessonSlots, eq(reservations.lessonSlotId, lessonSlots.id))
    .innerJoin(lessons, eq(lessonSlots.lessonId, lessons.id))
    .where(eq(reservations.memberId, auth.member.id))
    .orderBy(desc(lessonSlots.date));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  if (!body.lessonSlotId) {
    return NextResponse.json({ error: 'lessonSlotId is required' }, { status: 400 });
  }

  // スロット確認・重複チェック・INSERT を 1 トランザクションに包んで race condition を防止
  let slot: typeof lessonSlots.$inferSelect;
  let reservation: typeof reservations.$inferSelect;

  try {
    const result = await db.transaction(async (tx) => {
      const [s] = await tx.select().from(lessonSlots).where(eq(lessonSlots.id, body.lessonSlotId));
      if (!s) throw Object.assign(new Error('Slot not found'), { status: 404 });
      if (s.status !== 'open') throw Object.assign(new Error('Slot not available'), { status: 409 });

      const [dup] = await tx.select().from(reservations).where(
        and(
          eq(reservations.lessonSlotId, body.lessonSlotId),
          eq(reservations.memberId, auth.member.id),
          eq(reservations.status, 'confirmed')
        )
      );
      if (dup) throw Object.assign(new Error('Already reserved'), { status: 409 });

      // 振替クレジット使用（トランザクション内でアトミックに処理）
      if (body.isSubstitution && body.creditId) {
        const [credit] = await tx.select().from(substitutionCredits).where(
          and(
            eq(substitutionCredits.id, body.creditId),
            eq(substitutionCredits.memberId, auth.member.id)
          )
        );
        if (!credit) throw Object.assign(new Error('Substitution credit not found'), { status: 404 });
        if (credit.usedAt) throw Object.assign(new Error('Credit already used'), { status: 409 });
        if (new Date(credit.expiresAt) < new Date()) throw Object.assign(new Error('Credit expired'), { status: 409 });
      }

      const [created] = await tx.insert(reservations).values({
        id: generateId(),
        lessonSlotId: body.lessonSlotId,
        memberId: auth.member.id,
        status: 'confirmed',
        isSubstitution: body.isSubstitution ?? false,
        notes: body.notes?.trim() ?? null,
      }).returning();

      // クレジット消費（予約作成と同一トランザクション）
      if (body.isSubstitution && body.creditId) {
        await tx.update(substitutionCredits)
          .set({ usedAt: new Date(), usedReservationId: created.id })
          .where(eq(substitutionCredits.id, body.creditId));
      }

      return { slot: s, created };
    });

    slot = result.slot;
    reservation = result.created;
  } catch (err) {
    const e = err as Error & { status?: number };
    const status = e.status ?? 500;
    if (status < 500) return NextResponse.json({ error: e.message }, { status });
    throw err;
  }

  // 通知
  const [lesson] = await db.select({ title: lessons.title }).from(lessons).where(eq(lessons.id, slot.lessonId));
  notifyReservationConfirmed({
    memberName: auth.member.name,
    memberEmail: auth.member.email,
    memberLineUserId: auth.member.lineUserId,
    lessonTitle: lesson?.title ?? 'レッスン',
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    isSubstitution: body.isSubstitution ?? false,
  }).catch(console.error);

  return NextResponse.json(reservation, { status: 201 });
}
