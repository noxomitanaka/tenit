/**
 * 大会ブラケット生成アルゴリズム（副作用なし・純粋関数）
 * - swiss       : スイスドロー（点数近い同士でペア、再対戦回避）
 * - elimination : シングルエリミネーション（シード順ブラケット）
 * - round_robin : 全員対戦（円卓法でラウンド生成）
 */

export interface Player {
  id: string;
  points: number;
  wins: number;
  opponents: string[]; // 過去に対戦した相手IDリスト
}

export interface MatchPair {
  player1Id: string;
  player2Id: string | null; // null = BYE
}

// ─── スイスドロー ──────────────────────────────────────────────────────────────

/**
 * 1ラウンド分のペアを生成する。
 * プレイヤーを得点降順でソートし、貪欲に未対戦ペアを探す。
 */
export function generateSwissRound(players: Player[]): MatchPair[] {
  const sorted = [...players].sort((a, b) => b.points - a.points || b.wins - a.wins);
  const paired = new Set<string>();
  const pairs: MatchPair[] = [];

  for (const p of sorted) {
    if (paired.has(p.id)) continue;
    // 同得点帯から未対戦の相手を探す
    const opponent = sorted.find(
      (o) => !paired.has(o.id) && o.id !== p.id && !p.opponents.includes(o.id)
    ) ?? sorted.find(
      // 全員と当たっていれば再対戦を許容（ラウンドが多い場合）
      (o) => !paired.has(o.id) && o.id !== p.id
    );

    if (opponent) {
      pairs.push({ player1Id: p.id, player2Id: opponent.id });
      paired.add(p.id);
      paired.add(opponent.id);
    } else {
      // BYE
      pairs.push({ player1Id: p.id, player2Id: null });
      paired.add(p.id);
    }
  }

  return pairs;
}

// ─── シングルエリミネーション ──────────────────────────────────────────────────

/**
 * 第1ラウンドのブラケットを生成する。
 * 参加者数を 2^n に切り上げ、余りを BYE で埋める。
 * シード1 vs 最下位、シード2 vs その次…という標準配置。
 */
export function generateEliminationBracket(playerIds: string[]): MatchPair[] {
  const n = playerIds.length;
  const size = Math.pow(2, Math.ceil(Math.log2(Math.max(n, 2))));
  const padded = [...playerIds, ...Array(size - n).fill(null)];

  const pairs: MatchPair[] = [];
  for (let i = 0; i < size / 2; i++) {
    pairs.push({
      player1Id: padded[i] as string,
      player2Id: padded[size - 1 - i] as string | null,
    });
  }
  return pairs;
}

/**
 * エリミネーションの次ラウンドを生成する（前ラウンドの勝者リストから）。
 */
export function generateNextEliminationRound(winnerIds: (string | null)[]): MatchPair[] {
  const pairs: MatchPair[] = [];
  for (let i = 0; i < winnerIds.length; i += 2) {
    pairs.push({
      player1Id: winnerIds[i]!,
      player2Id: winnerIds[i + 1] ?? null,
    });
  }
  return pairs;
}

// ─── ラウンドロビン ────────────────────────────────────────────────────────────

/**
 * 全ラウンドの対戦リストを生成する（円卓法）。
 * n 人の場合、(n-1) ラウンドで全員一回ずつ対戦（n が奇数なら BYE を追加）。
 */
export function generateRoundRobin(playerIds: string[]): MatchPair[][] {
  const ids = [...playerIds];
  if (ids.length % 2 !== 0) ids.push('BYE'); // 奇数なら BYE を追加

  const n = ids.length;
  const rounds: MatchPair[][] = [];

  for (let r = 0; r < n - 1; r++) {
    const pairs: MatchPair[] = [];
    for (let i = 0; i < n / 2; i++) {
      const p1 = ids[i];
      const p2 = ids[n - 1 - i];
      pairs.push({
        player1Id: p1 === 'BYE' ? p2 : p1,
        player2Id: p1 === 'BYE' || p2 === 'BYE' ? null : p2,
      });
    }
    rounds.push(pairs);

    // 円卓回転: 最初の要素を固定し残りを時計回りに回す
    const last = ids[n - 1];
    for (let i = n - 1; i > 1; i--) ids[i] = ids[i - 1];
    ids[1] = last;
  }

  return rounds;
}

/** スイスドローの最大ラウンド数（参加者数に基づく推奨値） */
export function recommendedSwissRounds(playerCount: number): number {
  return Math.ceil(Math.log2(playerCount)) + 1;
}
