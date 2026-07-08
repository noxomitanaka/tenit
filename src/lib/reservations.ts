/**
 * 予約キャンセルに伴う振替クレジット発行の共通ロジック。
 * 会員ポータル（DELETE）と管理者（PATCH）の両経路で同一規則を適用するために抽出した。
 * 経路ごとに規則が分岐すると credit farming（期限後キャンセルでのクレジット荒稼ぎ）や
 * 二重発行を招くため、判定はここへ一本化する。
 */
import { db, asRows } from '@/db';
import { substitutionCredits, lessonSlots, clubSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/id';

/** db.transaction のコールバックが受け取るトランザクションハンドル型 */
type Tx = Parameters<Parameters<(typeof db)['transaction']>[0]>[0];

type CancellableReservation = {
  id: string;
  memberId: string;
  lessonSlotId: string;
  isSubstitution: boolean;
};

/**
 * キャンセル期限内かつ通常予約のときだけ振替クレジットを発行する（冪等）。
 * - 振替予約のキャンセルには発行しない
 * - レッスン開始まで cancellationDeadlineHours 未満なら発行しない（直前・事後キャンセル対策）
 * - 同一予約発の既存クレジットがあれば再発行しない（PATCH の往復による無限増殖対策）
 *
 * 呼び出し元のトランザクション内で実行すること。発行した credit（なければ null）を返す。
 */
export async function issueCancellationCredit(
  tx: Tx,
  reservation: CancellableReservation
): Promise<typeof substitutionCredits.$inferSelect | null> {
  if (reservation.isSubstitution) return null;

  const [settings] = await tx.select().from(clubSettings).limit(1);
  const deadlineDays = settings?.substitutionDeadlineDays ?? 31;
  const cancellationDeadlineHours = settings?.cancellationDeadlineHours ?? 24;

  const [slot] = await tx
    .select({ date: lessonSlots.date, startTime: lessonSlots.startTime })
    .from(lessonSlots)
    .where(eq(lessonSlots.id, reservation.lessonSlotId));
  if (slot) {
    const lessonStart = new Date(`${slot.date}T${slot.startTime}:00`);
    const hoursUntilLesson = (lessonStart.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilLesson < cancellationDeadlineHours) return null;
  }

  // 冪等ガード: 同一予約から既にクレジットが出ていれば発行しない
  const [dup] = await tx
    .select({ id: substitutionCredits.id })
    .from(substitutionCredits)
    .where(eq(substitutionCredits.sourceReservationId, reservation.id));
  if (dup) return null;

  const expiresAt = new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000);
  const [credit] = asRows(
    await tx
      .insert(substitutionCredits)
      .values({
        id: generateId(),
        memberId: reservation.memberId,
        sourceReservationId: reservation.id,
        expiresAt,
      })
      .returning()
  );
  return credit;
}
