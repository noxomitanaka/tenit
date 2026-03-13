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

  const [slot] = await db.select().from(lessonSlots).where(eq(lessonSlots.id, body.lessonSlotId));
  if (!slot) return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
  if (slot.status !== 'open') {
    return NextResponse.json({ error: 'Slot not available' }, { status: 409 });
  }

  // 重複チェック
  const [dup] = await db.select().from(reservations).where(
    and(
      eq(reservations.lessonSlotId, body.lessonSlotId),
      eq(reservations.memberId, auth.member.id),
      eq(reservations.status, 'confirmed')
    )
  );
  if (dup) return NextResponse.json({ error: 'Already reserved' }, { status: 409 });

  const [reservation] = await db.insert(reservations).values({
    id: generateId(),
    lessonSlotId: body.lessonSlotId,
    memberId: auth.member.id,
    status: 'confirmed',
    isSubstitution: body.isSubstitution ?? false,
    notes: body.notes?.trim() ?? null,
  }).returning();

  // 振替クレジット使用
  if (body.isSubstitution && body.creditId) {
    await db.update(substitutionCredits)
      .set({ usedAt: new Date(), usedReservationId: reservation.id })
      .where(eq(substitutionCredits.id, body.creditId));
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
