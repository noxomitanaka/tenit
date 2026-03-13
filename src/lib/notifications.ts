/**
 * 統合通知ヘルパー — メール + LINE を一元管理
 */
import { sendEmail } from './email';
import { sendLinePush } from './line';
import { db } from '@/db';
import { clubSettings } from '@/db/schema';

async function getLineToken(): Promise<string | null> {
  const [settings] = await db.select({ t: clubSettings.lineChannelAccessToken }).from(clubSettings);
  return settings?.t ?? null;
}

/** 予約確認通知 */
export async function notifyReservationConfirmed(opts: {
  memberName: string;
  memberEmail: string | null;
  memberLineUserId: string | null;
  lessonTitle: string;
  date: string;
  startTime: string;
  endTime: string;
  isSubstitution: boolean;
}): Promise<void> {
  const label = opts.isSubstitution ? '振替レッスン' : 'レッスン';
  const text = `【${label}予約確認】\n${opts.memberName}様\n\n日時: ${opts.date} ${opts.startTime}〜${opts.endTime}\nレッスン: ${opts.lessonTitle}\n\nご参加をお待ちしております。`;

  await Promise.all([
    opts.memberEmail
      ? sendEmail({
          to: opts.memberEmail,
          subject: `${label}予約を受け付けました`,
          text,
        })
      : Promise.resolve(),
    (async () => {
      const token = await getLineToken();
      await sendLinePush({
        channelAccessToken: token,
        lineUserId: opts.memberLineUserId,
        text,
      });
    })(),
  ]);
}

/** 予約キャンセル通知（振替クレジット生成時） */
export async function notifyReservationCancelled(opts: {
  memberName: string;
  memberEmail: string | null;
  memberLineUserId: string | null;
  lessonTitle: string;
  date: string;
  startTime: string;
  creditExpiresAt: Date;
}): Promise<void> {
  const expiry = opts.creditExpiresAt.toLocaleDateString('ja-JP');
  const text = `【キャンセル・振替クレジット発行】\n${opts.memberName}様\n\n${opts.date} ${opts.startTime}〜のレッスン（${opts.lessonTitle}）がキャンセルされました。\n振替クレジットを1件発行しました。有効期限: ${expiry}`;

  await Promise.all([
    opts.memberEmail
      ? sendEmail({
          to: opts.memberEmail,
          subject: 'キャンセル受付・振替クレジット発行',
          text,
        })
      : Promise.resolve(),
    (async () => {
      const token = await getLineToken();
      await sendLinePush({
        channelAccessToken: token,
        lineUserId: opts.memberLineUserId,
        text,
      });
    })(),
  ]);
}
