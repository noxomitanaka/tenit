/**
 * 会員ポータル予約キャンセル
 */
import { NextResponse } from 'next/server';
import { db, asRows } from '@/db';
import { reservations, lessonSlots, lessons, members } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireMember } from '@/lib/api-auth';
import { issueCancellationCredit } from '@/lib/reservations';
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

  // ステータス更新とクレジット発行を単一トランザクションに包む。
  // UPDATE の WHERE に status='confirmed' を含めることで、並行二重キャンセルの
  // 片方だけを成立させ、クレジットの重複発行を防ぐ（check-then-act の解消）。
  let updated: typeof reservations.$inferSelect;
  let credit: Awaited<ReturnType<typeof issueCancellationCredit>> = null;
  try {
    const result = await db.transaction(async (tx) => {
      const rows = asRows(await tx.update(reservations)
        .set({ status: 'cancelled' })
        .where(and(eq(reservations.id, id), eq(reservations.status, 'confirmed')))
        .returning());
      if (rows.length === 0) {
        throw Object.assign(new Error('Already cancelled'), { status: 409 });
      }
      const issued = await issueCancellationCredit(tx, existing);
      return { updated: rows[0], credit: issued };
    });
    updated = result.updated;
    credit = result.credit;
  } catch (err) {
    const e = err as Error & { status?: number };
    const status = e.status ?? 500;
    if (status < 500) return NextResponse.json({ error: e.message }, { status });
    throw err;
  }

  // キャンセル通知（クレジットが発行された通常予約のみ・非同期）
  if (credit) {
    const [slot] = await db.select().from(lessonSlots).where(eq(lessonSlots.id, existing.lessonSlotId));
    const [lesson] = slot
      ? await db.select({ title: lessons.title }).from(lessons).where(eq(lessons.id, slot.lessonId))
      : [undefined];
    const [member] = await db.select().from(members).where(eq(members.id, auth.member.id));
    if (slot && member) {
      notifyReservationCancelled({
        memberName: member.name,
        memberEmail: member.email,
        memberLineUserId: member.lineUserId,
        lessonTitle: lesson?.title ?? 'レッスン',
        date: slot.date,
        startTime: slot.startTime,
        creditExpiresAt: credit.expiresAt,
      }).catch(console.error);
    }
  }

  return NextResponse.json({ reservation: updated, credit });
}
