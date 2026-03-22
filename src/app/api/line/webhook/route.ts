/**
 * LINE Messaging API Webhook
 * - フォロー時: lineUserId を記録してリンク用トークンを発行
 * - テキスト「リンク XXXX」: 会員IDと紐付ける
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateLineSignature } from '@/lib/line';
import { db } from '@/db';
import { clubSettings, members, lineLinkPins } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import type { WebhookRequestBody, FollowEvent, MessageEvent, TextMessage } from '@line/bot-sdk';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const [settings] = await db.select().from(clubSettings);
  if (!settings?.lineChannelSecret) {
    return NextResponse.json({ error: 'LINE not configured' }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-line-signature') ?? '';

  if (!validateLineSignature(rawBody, signature, settings.lineChannelSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const body: WebhookRequestBody = JSON.parse(rawBody);

  for (const event of body.events) {
    if (event.source.type !== 'user') continue;
    const lineUserId = event.source.userId;

    // フォローイベント: lineUserId を members に自動保存（後でリンク可能）
    if ((event as FollowEvent).type === 'follow') {
      console.log('[LINE webhook] フォロー:', lineUserId);
      // lineUserId がまだどの会員にも紐付いていない場合はスキップ
      // （リンクは「リンク <会員ID>」メッセージで行う）
    }

    // テキストメッセージ: 「リンク <PIN>」でPIN認証を経て会員と紐付け
    if ((event as MessageEvent).type === 'message') {
      const msg = event as MessageEvent;
      if ((msg.message as TextMessage).type === 'text') {
        const text = (msg.message as TextMessage).text.trim();
        const match = text.match(/^リンク\s+(\d{6})$/);
        if (match) {
          const pin = match[1];
          // 未使用かつ有効期限内のPINを検索
          const [linkPin] = await db.select().from(lineLinkPins).where(
            and(
              eq(lineLinkPins.pin, pin),
              gt(lineLinkPins.expiresAt, new Date()),
            )
          );
          if (linkPin && !linkPin.usedAt) {
            await db.update(members).set({ lineUserId }).where(eq(members.id, linkPin.memberId));
            await db.update(lineLinkPins).set({ usedAt: new Date() }).where(eq(lineLinkPins.id, linkPin.id));
            console.log(`[LINE webhook] PIN認証リンク: ${linkPin.memberId} ← ${lineUserId}`);
          } else {
            console.log(`[LINE webhook] 無効なPIN: ${pin}`);
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
