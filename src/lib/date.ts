/**
 * クラブのタイムゾーン（JST 固定）に基づく日付ユーティリティ。
 * lessonSlots.date 等はクラブ現地の YYYY-MM-DD で保存されるため、
 * サーバー TZ（Vercel=UTC 等）に依存せずクラブTZで日付を扱う。
 */
export const CLUB_TIMEZONE = 'Asia/Tokyo';

/** クラブTZでの「今日」を YYYY-MM-DD で返す。en-CA ロケールは ISO 形式。 */
export function clubToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CLUB_TIMEZONE }).format(now);
}

/** クラブ現地日時（YYYY-MM-DD + HH:MM）を絶対時刻の Date に変換する。 */
export function clubDateTime(date: string, time: string): Date {
  // JST は UTC+9 固定（サマータイムなし）のため +09:00 を明示する。
  return new Date(`${date}T${time}:00+09:00`);
}
