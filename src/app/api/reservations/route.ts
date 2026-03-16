import { NextResponse } from 'next/server';
import { db } from '@/db';
import { reservations, lessonSlots, lessons, members, substitutionCredits } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { requireAdmin } from '@/lib/api-auth';
import { notifyReservationConfirmed } from '@/lib/notifications';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const slotId = searchParams.get('slotId');
  const memberId = searchParams.get('memberId');
  const status = searchParams.get('status') as 'confirmed' | 'cancelled' | 'absent' | null;

  const conds = [];
  if (slotId) conds.push(eq(reservations.lessonSlotId, slotId));
  if (memberId) conds.push(eq(reservations.memberId, memberId));
  if (status) conds.push(eq(reservations.status, status));

  const result = await db.select().from(reservations)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(reservations.createdAt);

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  if (!body.lessonSlotId || !body.memberId) {
    return NextResponse.json(
      { error: 'lessonSlotId and memberId are required' },
      { status: 400 }
    );
  }

  // スロット確認・重複チェック・INSERT を 1 トランザクションに包んで race condition を防止
  let slot: typeof lessonSlots.$inferSelect;
  let reservation: typeof reservations.$inferSelect;

  try {
    const result = await db.transaction(async (tx) => {
      const [s] = await tx.select().from(lessonSlots).where(eq(lessonSlots.id, body.lessonSlotId));
      if (!s) throw Object.assign(new Error('lesson slot not found'), { status: 404 });
      if (s.status !== 'open') throw Object.assign(new Error('lesson slot is not available'), { status: 409 });

      const [dup] = await tx.select().from(reservations).where(
        and(
          eq(reservations.lessonSlotId, body.lessonSlotId),
          eq(reservations.memberId, body.memberId),
          eq(reservations.status, 'confirmed')
        )
      );
      if (dup) throw Object.assign(new Error('reservation already exists'), { status: 409 });

      const [created] = await tx.insert(reservations).values({
        id: generateId(),
        lessonSlotId: body.lessonSlotId,
        memberId: body.memberId,
        status: 'confirmed',
        isSubstitution: body.isSubstitution ?? false,
        originalReservationId: body.originalReservationId ?? null,
        notes: body.notes?.trim() ?? null,
      }).returning();

      // 振替クレジットを使用済みにする（所有者・有効期限チェック付き）
      if (body.isSubstitution && body.creditId) {
        const [credit] = await tx.select().from(substitutionCredits).where(
          and(
            eq(substitutionCredits.id, body.creditId),
            eq(substitutionCredits.memberId, body.memberId)
          )
        );
        if (!credit) throw Object.assign(new Error('Substitution credit not found'), { status: 404 });
        if (credit.usedAt) throw Object.assign(new Error('Credit already used'), { status: 409 });
        if (new Date(credit.expiresAt) < new Date()) throw Object.assign(new Error('Credit expired'), { status: 409 });
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

  // 予約確認通知（非同期・失敗しても予約は通す）
  const [member] = await db.select().from(members).where(eq(members.id, body.memberId));
  const [lesson] = await db.select({ title: lessons.title })
    .from(lessons).where(eq(lessons.id, slot.lessonId));
  if (member) {
    notifyReservationConfirmed({
      memberName: member.name,
      memberEmail: member.email,
      memberLineUserId: member.lineUserId,
      lessonTitle: lesson?.title ?? 'レッスン',
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      isSubstitution: body.isSubstitution ?? false,
    }).catch(console.error);
  }

  return NextResponse.json(reservation, { status: 201 });
}
