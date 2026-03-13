/**
 * パスワードのハッシュ化ユーティリティ
 * Web Crypto API（Node.js 19+ / Edge Runtime対応）
 *
 * Note: Phase 1でbcryptに移行予定（SHA-256は一方向のみ、ストレッチングなし）
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(hash).toString('hex');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const hashed = await hashPassword(password);
  return hashed === hash;
}
