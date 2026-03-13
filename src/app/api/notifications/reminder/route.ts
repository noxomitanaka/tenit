/**
 * POST /api/notifications/reminder — 翌日レッスンのリマインドメール送信
 * cron ジョブや手動トリガーから呼ぶ
 * Body: { date?: "YYYY-MM-DD" }  省略時は翌日
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { lessonSlots, lessons, reservations, members } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { sendEmail } from '@/lib/email';
import { requireAdmin } from '@/lib/api-auth';

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const targetDate = (body.date as string | undefined) ?? tomorrow.toISOString().slice(0, 10);

  // 翌日のスロットを取得
  const slots = await db
    .select({
      slotId: lessonSlots.id,
      date: lessonSlots.date,
      startTime: lessonSlots.startTime,
      endTime: lessonSlots.endTime,
      lessonTitle: lessons.title,
    })
    .from(lessonSlots)
    .innerJoin(lessons, eq(lessonSlots.lessonId, lessons.id))
    .where(and(eq(lessonSlots.date, targetDate), eq(lessonSlots.status, 'open')));

  if (slots.length === 0) {
    return NextResponse.json({ sent: 0, message: `${targetDate} のレッスンはありません` });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const slot of slots) {
    // このスロットの確定予約を取得
    const bookings = await db
      .select({
        memberId: reservations.memberId,
        memberName: members.name,
        memberEmail: members.email,
      })
      .from(reservations)
      .innerJoin(members, eq(reservations.memberId, members.id))
      .where(and(eq(reservations.lessonSlotId, slot.slotId), eq(reservations.status, 'confirmed')));

    for (const booking of bookings) {
      if (!booking.memberEmail) continue;
      try {
        await sendEmail({
          to: booking.memberEmail,
          subject: `【明日のレッスン】${slot.lessonTitle} リマインド`,
          text: [
            `${booking.memberName} 様`,
            '',
            `明日のレッスンのご案内です。`,
            '',
            `レッスン: ${slot.lessonTitle}`,
            `日時: ${slot.date} ${slot.startTime}〜${slot.endTime}`,
            '',
            'ご不明な点は管理者までご連絡ください。',
          ].join('\n'),
        });
        sent++;
      } catch (err) {
        errors.push(`${booking.memberName}: ${err instanceof Error ? err.message : 'error'}`);
      }
    }
  }

  return NextResponse.json({
    targetDate,
    slots: slots.length,
    sent,
    errors,
  });
}
