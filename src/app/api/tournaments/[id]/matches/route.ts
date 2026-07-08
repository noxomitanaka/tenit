/**
 * 大会マッチ生成・スコア更新
 * POST: ラウンドを生成（アルゴリズム選択）
 * PUT:  スコア・勝者を記録してエントリーの集計を更新
 */
import { NextResponse } from 'next/server';
import { db, asRows } from '@/db';
import { tournaments, tournamentEntries, tournamentMatches, members } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { requireAdmin } from '@/lib/api-auth';
import {
  generateSwissRound,
  generateEliminationBracket,
  generateNextEliminationRound,
  generateRoundRobin,
  type Player,
} from '@/lib/tournament';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: tournamentId } = await params;
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const entries = await db.select().from(tournamentEntries)
    .where(eq(tournamentEntries.tournamentId, tournamentId));
  if (entries.length < 2) {
    return NextResponse.json({ error: 'At least 2 entries required' }, { status: 400 });
  }

  const existingMatches = await db.select().from(tournamentMatches)
    .where(eq(tournamentMatches.tournamentId, tournamentId));

  let pairs: { player1Id: string; player2Id: string | null }[] = [];

  if (tournament.type === 'swiss') {
    const players: Player[] = entries.map((e) => {
      const opponentIds = existingMatches
        .filter(m => m.player1Id === e.memberId || m.player2Id === e.memberId)
        .map(m => m.player1Id === e.memberId ? m.player2Id : m.player1Id)
        .filter(Boolean) as string[];
      return { id: e.memberId, points: e.points, wins: e.wins, opponents: opponentIds };
    });
    pairs = generateSwissRound(players);
  } else if (tournament.type === 'elimination') {
    if (existingMatches.length === 0) {
      // 第1ラウンド: シード順で並べてブラケット生成
      const seeded = [...entries].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));
      pairs = generateEliminationBracket(seeded.map(e => e.memberId));
    } else {
      // 前ラウンドの勝者から次ラウンド生成
      const maxRound = Math.max(...existingMatches.map(m => m.round));
      const prevRoundMatches = existingMatches.filter(m => m.round === maxRound);
      const allCompleted = prevRoundMatches.every(m => m.winnerId || !m.player2Id);
      if (!allCompleted) {
        return NextResponse.json({ error: 'Previous round not completed' }, { status: 409 });
      }
      const winners = prevRoundMatches.map(m => m.winnerId ?? m.player1Id);
      pairs = generateNextEliminationRound(winners);
    }
  } else {
    // round_robin: 全ラウンドを一括生成（既存なら不可）
    if (existingMatches.length > 0) {
      return NextResponse.json({ error: 'Round robin already generated' }, { status: 409 });
    }
    const allRounds = generateRoundRobin(entries.map(e => e.memberId));
    const values = allRounds.flatMap((roundPairs, ri) =>
      roundPairs.map(p => ({
        id: generateId(),
        tournamentId,
        round: ri + 1,
        player1Id: p.player1Id,
        player2Id: p.player2Id,
      }))
    );
    const inserted = asRows(await db.insert(tournamentMatches).values(values).returning());
    await db.update(tournaments).set({ status: 'active' }).where(eq(tournaments.id, tournamentId));
    return NextResponse.json(inserted, { status: 201 });
  }

  // 次ラウンド番号は swiss/elimination いずれも「現在の最大round+1」。
  // 旧実装は elimination で +0 としており、次ラウンドが前ラウンドと同じ
  // round 番号で生成され、前ラウンド完了判定・勝者抽出が破綻していた。
  const nextRound = existingMatches.length === 0
    ? 1
    : Math.max(...existingMatches.map(m => m.round)) + 1;

  const values = pairs.map(p => ({
    id: generateId(),
    tournamentId,
    round: nextRound,
    player1Id: p.player1Id,
    player2Id: p.player2Id,
  }));
  const inserted = asRows(await db.insert(tournamentMatches).values(values).returning());
  await db.update(tournaments).set({ status: 'active' }).where(eq(tournaments.id, tournamentId));

  return NextResponse.json(inserted, { status: 201 });
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: tournamentId } = await params;
  const body = await req.json();
  // body: { matchId, score1, score2, winnerId }

  if (!body.matchId || !body.winnerId) {
    return NextResponse.json({ error: 'matchId and winnerId required' }, { status: 400 });
  }

  const [match] = await db.select().from(tournamentMatches)
    .where(and(eq(tournamentMatches.id, body.matchId), eq(tournamentMatches.tournamentId, tournamentId)));
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

  // winnerId は対戦者のいずれかでなければならない（無関係IDでの集計汚染を防ぐ）
  if (body.winnerId !== match.player1Id && body.winnerId !== match.player2Id) {
    return NextResponse.json({ error: 'winnerId must be one of the match players' }, { status: 400 });
  }
  // 確定済みマッチの再送信は集計の二重加算を招くため拒否する（冪等性の担保）
  if (match.winnerId) {
    return NextResponse.json({ error: 'Match result already recorded' }, { status: 409 });
  }

  const winnerId = body.winnerId;
  const loserId = winnerId === match.player1Id ? match.player2Id : match.player1Id;

  const updated = await db.transaction(async (tx) => {
    const [matchResult] = asRows(await tx.update(tournamentMatches).set({
      score1: body.score1 ?? match.score1,
      score2: body.score2 ?? match.score2,
      winnerId,
      completedAt: new Date(),
    }).where(eq(tournamentMatches.id, body.matchId)).returning());

    // エントリー集計を勝者・敗者で対称に更新（各1回のみ）
    const [winnerEntry] = await tx.select().from(tournamentEntries)
      .where(and(eq(tournamentEntries.tournamentId, tournamentId), eq(tournamentEntries.memberId, winnerId)));
    if (winnerEntry) {
      await tx.update(tournamentEntries).set({
        wins: winnerEntry.wins + 1,
        points: winnerEntry.points + 3,
      }).where(eq(tournamentEntries.id, winnerEntry.id));
    }
    if (loserId) {
      const [loserEntry] = await tx.select().from(tournamentEntries)
        .where(and(eq(tournamentEntries.tournamentId, tournamentId), eq(tournamentEntries.memberId, loserId)));
      if (loserEntry) {
        await tx.update(tournamentEntries).set({
          losses: loserEntry.losses + 1,
        }).where(eq(tournamentEntries.id, loserEntry.id));
      }
    }

    return matchResult;
  });

  return NextResponse.json(updated);
}
