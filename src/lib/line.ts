/**
 * LINE Messaging API ラッパー
 * SMTP と同様、環境変数未設定時はログのみで実際には送信しない
 */
import * as line from '@line/bot-sdk';

interface LineConfig {
  channelAccessToken: string;
  channelSecret: string;
}

export function createLineClient(config: LineConfig): line.messagingApi.MessagingApiClient {
  return new line.messagingApi.MessagingApiClient({
    channelAccessToken: config.channelAccessToken,
  });
}

/** LINE の署名を検証する（webhook 受信時） */
export function validateLineSignature(
  body: string,
  signature: string,
  channelSecret: string
): boolean {
  return line.validateSignature(body, channelSecret, signature);
}

/**
 * 会員の LINE userId にプッシュ通知を送る
 * channelAccessToken / lineUserId が未設定なら何もしない（ログのみ）
 */
export async function sendLinePush(opts: {
  channelAccessToken: string | null | undefined;
  lineUserId: string | null | undefined;
  text: string;
}): Promise<void> {
  if (!opts.channelAccessToken || !opts.lineUserId) {
    console.log('[LINE] 未設定のためスキップ:', opts.text.slice(0, 50));
    return;
  }
  const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: opts.channelAccessToken,
  });
  await client.pushMessage({
    to: opts.lineUserId,
    messages: [{ type: 'text', text: opts.text }],
  });
}
