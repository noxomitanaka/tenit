/**
 * パスワードのハッシュ化ユーティリティ
 * bcryptjs（Pure JS — Edge Runtime / Node.js 両対応）
 *
 * Migration path: SHA-256（旧）→ bcrypt（新）
 * - 旧ハッシュ（64文字 hex）: 検証時に透過的に対応し、次回ログイン時に bcrypt へ自動移行
 * - 新ハッシュ（$2b$…）: bcrypt で検証
 */
import bcrypt from 'bcryptjs';

const ROUNDS = 12;

/** 新規パスワードを bcrypt でハッシュ化 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

/** パスワード検証（旧 SHA-256 形式も透過的に処理） */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (hash.startsWith('$2')) {
    return bcrypt.compare(password, hash);
  }
  // 旧 SHA-256 ハッシュ（64文字 hex）
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const buf = await crypto.subtle.digest('SHA-256', data);
  const sha256 = Buffer.from(buf).toString('hex');
  return sha256 === hash;
}

/** 旧 SHA-256 形式かどうか（ログイン時の再ハッシュ判断に使用） */
export function isLegacyHash(hash: string): boolean {
  return !hash.startsWith('$2');
}
