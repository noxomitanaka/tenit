/**
 * 軽量な入力検証ヘルパー（zod 非導入方針のため手書き）。
 * 各 API ルートで数値・メール・日付・enum を検証し、不正値の DB 到達
 * （NaN/Infinity バインドエラー・負値・巨大値・不正 enum）を防ぐ。
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 制御文字・改行を含まない有効なメール形式か（CRLF インジェクション対策込み）。 */
export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 254
    && EMAIL_RE.test(value)
    // eslint-disable-next-line no-control-regex
    && !/[\r\n\t\0]/.test(value);
}

/** 非負の安全整数（0〜max）か。金額・日数・時間などに使う。 */
export function isNonNegativeInt(value: unknown, max = 100_000_000): boolean {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(n) && n >= 0 && n <= max;
}

/** YYYY-MM-DD 形式かつ実在する日付か。 */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

/** 許可リストに含まれる値か（enum 検証）。 */
export function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

/** trim 済みの非空文字列か、かつ最大長以内か。 */
export function isNonEmptyString(value: unknown, maxLen = 1000): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLen;
}

/** 会員レベル・会員ステータスの許可値。schema の enum と一致させる。 */
export const MEMBER_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const MEMBER_STATUSES = ['active', 'inactive'] as const;
