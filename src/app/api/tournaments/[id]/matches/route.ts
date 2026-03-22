/**
 * 大会マッチ生成・スコア更新
 * POST: ラウンドを生成（アルゴリズム選択）
 * PUT:  スコア・勝者を記録してエントリーの集計を更新
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
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
    const inserted = await db.insert(tournamentMatches).values(values).returning();
    await db.update(tournaments).set({ status: 'active' }).where(eq(tournaments.id, tournamentId));
    return NextResponse.json(inserted, { status: 201 });
  }

  const nextRound = existingMatches.length === 0
    ? 1
    : Math.max(...existingMatches.map(m => m.round)) + (tournament.type === 'swiss' ? 1 : 0);

  const values = pairs.map(p => ({
    id: generateId(),
    tournamentId,
    round: tournament.type === 'swiss' ? nextRound : existingMatches.length === 0 ? 1 : nextRound,
    player1Id: p.player1Id,
    player2Id: p.player2Id,
  }));
  const inserted = await db.insert(tournamentMatches).values(values).returning();
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

  const updated = await db.transaction(async (tx) => {
    const [matchResult] = await tx.update(tournamentMatches).set({
      score1: body.score1 ?? match.score1,
      score2: body.score2 ?? match.score2,
      winnerId: body.winnerId,
      completedAt: new Date(),
    }).where(eq(tournamentMatches.id, body.matchId)).returning();

    // エントリーの集計更新
    const loserId = body.winnerId === match.player1Id ? match.player2Id : match.player1Id;
    if (match.player1Id) {
      const isWinner = match.player1Id === body.winnerId;
      const [e] = await tx.select().from(tournamentEntries)
        .where(and(eq(tournamentEntries.tournamentId, tournamentId), eq(tournamentEntries.memberId, match.player1Id)));
      if (e) {
        await tx.update(tournamentEntries).set({
          wins: isWinner ? e.wins + 1 : e.wins,
          losses: isWinner ? e.losses : e.losses + 1,
          points: isWinner ? e.points + 3 : e.points,
        }).where(eq(tournamentEntries.id, e.id));
      }
    }
    if (loserId) {
      const [e] = await tx.select().from(tournamentEntries)
        .where(and(eq(tournamentEntries.tournamentId, tournamentId), eq(tournamentEntries.memberId, loserId)));
      if (e) {
        await tx.update(tournamentEntries).set({
          losses: e.losses + 1,
        }).where(eq(tournamentEntries.id, e.id));
      }
    }

    return matchResult;
  });

  return NextResponse.json(updated);
}
