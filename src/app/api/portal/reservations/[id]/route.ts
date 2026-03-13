/**
 * 会員ポータル予約キャンセル
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { reservations, lessonSlots, lessons, members, substitutionCredits, clubSettings } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { requireMember } from '@/lib/api-auth';
import { notifyReservationCancelled } from '@/lib/notifications';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const [existing] = await db.select().from(reservations)
    .where(and(eq(reservations.id, id), eq(reservations.memberId, auth.member.id)));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.status !== 'confirmed') {
    return NextResponse.json({ error: 'Already cancelled' }, { status: 409 });
  }

  const [updated] = await db.update(reservations)
    .set({ status: 'cancelled' })
    .where(eq(reservations.id, id))
    .returning();

  // 振替クレジット発行（通常予約のキャンセルのみ）
  let credit = null;
  if (!existing.isSubstitution) {
    const [settings] = await db.select().from(clubSettings);
    const deadlineDays = settings?.substitutionDeadlineDays ?? 31;
    const expiresAt = new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000);
    [credit] = await db.insert(substitutionCredits).values({
      id: generateId(),
      memberId: auth.member.id,
      sourceReservationId: existing.id,
      expiresAt,
    }).returning();

    // キャンセル通知
    const [slot] = await db.select().from(lessonSlots).where(eq(lessonSlots.id, existing.lessonSlotId));
    const [lesson] = await db.select({ title: lessons.title }).from(lessons).where(eq(lessons.id, slot.lessonId));
    const [member] = await db.select().from(members).where(eq(members.id, auth.member.id));
    if (slot && member) {
      notifyReservationCancelled({
        memberName: member.name,
        memberEmail: member.email,
        memberLineUserId: member.lineUserId,
        lessonTitle: lesson?.title ?? 'レッスン',
        date: slot.date,
        startTime: slot.startTime,
        creditExpiresAt: expiresAt,
      }).catch(console.error);
    }
  }

  return NextResponse.json({ reservation: updated, credit });
}
