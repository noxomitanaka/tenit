/**
 * Integration tests: /api/tournaments (大会管理API)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { members, tournaments, tournamentEntries, tournamentMatches } from '@/db/schema';

vi.mock('@/db', () => ({ db: testDb }));
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin' as const },
  }),
}));

const { GET, POST } = await import('@/app/api/tournaments/route');
const { GET: GET_ID } = await import('@/app/api/tournaments/[id]/route');
const { POST: POST_ENTRY } = await import('@/app/api/tournaments/[id]/entries/route');
const { POST: POST_MATCH, PUT: PUT_MATCH } = await import('@/app/api/tournaments/[id]/matches/route');

function makeReq(method: string, url: string, body?: object) {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}
function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function seedMembers() {
  await testDb.insert(members).values([
    { id: 'm1', name: '田中', status: 'active' },
    { id: 'm2', name: '鈴木', status: 'active' },
    { id: 'm3', name: '佐藤', status: 'active' },
    { id: 'm4', name: '伊藤', status: 'active' },
  ]);
}

beforeEach(async () => { await resetDb(); });

// ─── 大会CRUD ───────────────────────────────────────

describe('GET /api/tournaments', () => {
  it('大会が存在しない場合は空配列', async () => {
    const res = await GET(makeReq('GET', 'http://localhost/api/tournaments'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('大会リストを返す', async () => {
    await testDb.insert(tournaments).values({
      id: 't1', name: '春季大会', type: 'swiss', status: 'draft', rounds: 3,
    });
    const res = await GET(makeReq('GET', 'http://localhost/api/tournaments'));
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].name).toBe('春季大会');
  });
});

describe('POST /api/tournaments', () => {
  it('スイスドロー大会を作成できる', async () => {
    const res = await POST(makeReq('POST', 'http://localhost/api/tournaments', {
      name: '春季オープン', type: 'swiss', rounds: 4,
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.name).toBe('春季オープン');
    expect(json.type).toBe('swiss');
    expect(json.status).toBe('draft');
    expect(json.rounds).toBe(4);
    expect(json.id).toBeTruthy();
  });

  it('ラウンドロビン大会を作成できる', async () => {
    const res = await POST(makeReq('POST', 'http://localhost/api/tournaments', {
      name: '総当たり戦', type: 'round_robin',
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.type).toBe('round_robin');
  });

  it('name未指定は400エラー', async () => {
    const res = await POST(makeReq('POST', 'http://localhost/api/tournaments', { type: 'swiss' }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/tournaments/[id]', () => {
  it('大会・エントリー・マッチを返す', async () => {
    await seedMembers();
    await testDb.insert(tournaments).values({ id: 't1', name: '大会A', type: 'swiss', status: 'draft', rounds: 3 });
    await testDb.insert(tournamentEntries).values({ id: 'e1', tournamentId: 't1', memberId: 'm1' });

    const res = await GET_ID(makeReq('GET', 'http://localhost/api/tournaments/t1'), params('t1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tournament.name).toBe('大会A');
    expect(json.entries).toHaveLength(1);
    expect(json.entries[0].memberName).toBe('田中');
    expect(json.matches).toHaveLength(0);
  });

  it('存在しない大会は404', async () => {
    const res = await GET_ID(makeReq('GET', 'http://localhost/api/tournaments/none'), params('none'));
    expect(res.status).toBe(404);
  });
});

// ─── エントリー管理 ─────────────────────────────────

describe('POST /api/tournaments/[id]/entries', () => {
  it('参加者を追加できる', async () => {
    await seedMembers();
    await testDb.insert(tournaments).values({ id: 't1', name: '大会', type: 'swiss', status: 'draft', rounds: 3 });

    const res = await POST_ENTRY(
      makeReq('POST', 'http://localhost/api/tournaments/t1/entries', { memberId: 'm1' }),
      params('t1')
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.memberId).toBe('m1');
    expect(json.wins).toBe(0);
    expect(json.points).toBe(0);
  });

  it('重複エントリーは409', async () => {
    await seedMembers();
    await testDb.insert(tournaments).values({ id: 't1', name: '大会', type: 'swiss', status: 'draft', rounds: 3 });
    await testDb.insert(tournamentEntries).values({ id: 'e1', tournamentId: 't1', memberId: 'm1' });

    const res = await POST_ENTRY(
      makeReq('POST', 'http://localhost/api/tournaments/t1/entries', { memberId: 'm1' }),
      params('t1')
    );
    expect(res.status).toBe(409);
  });

  it('active状態の大会へのエントリーは409', async () => {
    await seedMembers();
    await testDb.insert(tournaments).values({ id: 't1', name: '大会', type: 'swiss', status: 'active', rounds: 3 });

    const res = await POST_ENTRY(
      makeReq('POST', 'http://localhost/api/tournaments/t1/entries', { memberId: 'm1' }),
      params('t1')
    );
    expect(res.status).toBe(409);
  });

  it('存在しない会員は404', async () => {
    await testDb.insert(tournaments).values({ id: 't1', name: '大会', type: 'swiss', status: 'draft', rounds: 3 });

    const res = await POST_ENTRY(
      makeReq('POST', 'http://localhost/api/tournaments/t1/entries', { memberId: 'nonexistent' }),
      params('t1')
    );
    expect(res.status).toBe(404);
  });
});

// ─── マッチ生成 ──────────────────────────────────────

describe('POST /api/tournaments/[id]/matches (スイスドロー)', () => {
  async function seedSwissTournament() {
    await seedMembers();
    await testDb.insert(tournaments).values({ id: 't1', name: 'スイス大会', type: 'swiss', status: 'draft', rounds: 3 });
    await testDb.insert(tournamentEntries).values([
      { id: 'e1', tournamentId: 't1', memberId: 'm1' },
      { id: 'e2', tournamentId: 't1', memberId: 'm2' },
      { id: 'e3', tournamentId: 't1', memberId: 'm3' },
      { id: 'e4', tournamentId: 't1', memberId: 'm4' },
    ]);
  }

  it('第1ラウンドを生成できる', async () => {
    await seedSwissTournament();
    const res = await POST_MATCH(
      makeReq('POST', 'http://localhost/api/tournaments/t1/matches', {}),
      params('t1')
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toHaveLength(2); // 4人→2試合
    expect(json[0].round).toBe(1);
    expect(json[0].player1Id).toBeTruthy();
    expect(json[0].player2Id).toBeTruthy();
  });

  it('大会がactiveに変わる', async () => {
    await seedSwissTournament();
    await POST_MATCH(
      makeReq('POST', 'http://localhost/api/tournaments/t1/matches', {}),
      params('t1')
    );
    const [t] = await testDb.select().from(tournaments);
    expect(t.status).toBe('active');
  });

  it('参加者が2名未満の場合は400', async () => {
    await seedMembers();
    await testDb.insert(tournaments).values({ id: 't1', name: '大会', type: 'swiss', status: 'draft', rounds: 3 });
    await testDb.insert(tournamentEntries).values({ id: 'e1', tournamentId: 't1', memberId: 'm1' });

    const res = await POST_MATCH(
      makeReq('POST', 'http://localhost/api/tournaments/t1/matches', {}),
      params('t1')
    );
    expect(res.status).toBe(400);
  });
});

describe('POST /api/tournaments/[id]/matches (ラウンドロビン)', () => {
  it('全ラウンドを一括生成できる', async () => {
    await seedMembers();
    await testDb.insert(tournaments).values({ id: 't1', name: 'RR大会', type: 'round_robin', status: 'draft', rounds: 3 });
    await testDb.insert(tournamentEntries).values([
      { id: 'e1', tournamentId: 't1', memberId: 'm1' },
      { id: 'e2', tournamentId: 't1', memberId: 'm2' },
      { id: 'e3', tournamentId: 't1', memberId: 'm3' },
    ]);

    const res = await POST_MATCH(
      makeReq('POST', 'http://localhost/api/tournaments/t1/matches', {}),
      params('t1')
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    // 3人(奇数)→BYE追加で4人扱い: 3ラウンド×2試合=6、うち3つがBYE(player2Id=null)
    expect(json).toHaveLength(6);
    const byeMatches = json.filter((m: { player2Id: string | null }) => m.player2Id === null);
    expect(byeMatches).toHaveLength(3);
  });

  it('2回目の生成は409', async () => {
    await seedMembers();
    await testDb.insert(tournaments).values({ id: 't1', name: 'RR大会', type: 'round_robin', status: 'active', rounds: 3 });
    await testDb.insert(tournamentEntries).values([
      { id: 'e1', tournamentId: 't1', memberId: 'm1' },
      { id: 'e2', tournamentId: 't1', memberId: 'm2' },
    ]);
    await testDb.insert(tournamentMatches).values({
      id: 'match1', tournamentId: 't1', round: 1, player1Id: 'm1', player2Id: 'm2',
    });

    const res = await POST_MATCH(
      makeReq('POST', 'http://localhost/api/tournaments/t1/matches', {}),
      params('t1')
    );
    expect(res.status).toBe(409);
  });
});

// ─── スコア記録 ──────────────────────────────────────

describe('PUT /api/tournaments/[id]/matches', () => {
  async function seedMatch() {
    await seedMembers();
    await testDb.insert(tournaments).values({ id: 't1', name: '大会', type: 'swiss', status: 'active', rounds: 3 });
    await testDb.insert(tournamentEntries).values([
      { id: 'e1', tournamentId: 't1', memberId: 'm1', wins: 0, losses: 0, points: 0 },
      { id: 'e2', tournamentId: 't1', memberId: 'm2', wins: 0, losses: 0, points: 0 },
    ]);
    await testDb.insert(tournamentMatches).values({
      id: 'match1', tournamentId: 't1', round: 1, player1Id: 'm1', player2Id: 'm2',
    });
  }

  it('スコアと勝者を記録できる', async () => {
    await seedMatch();
    const res = await PUT_MATCH(
      makeReq('PUT', 'http://localhost/api/tournaments/t1/matches', {
        matchId: 'match1', score1: '6', score2: '4', winnerId: 'm1',
      }),
      params('t1')
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.winnerId).toBe('m1');
    expect(json.score1).toBe('6');
    expect(json.score2).toBe('4');
  });

  it('勝者のwins・pointsが増加する', async () => {
    await seedMatch();
    await PUT_MATCH(
      makeReq('PUT', 'http://localhost/api/tournaments/t1/matches', {
        matchId: 'match1', score1: '6', score2: '4', winnerId: 'm1',
      }),
      params('t1')
    );
    const all = await testDb.select().from(tournamentEntries);
    const winner = all.find(e => e.memberId === 'm1')!;
    expect(winner.wins).toBe(1);
    expect(winner.points).toBe(3);
  });

  it('matchId未指定は400', async () => {
    await seedMatch();
    const res = await PUT_MATCH(
      makeReq('PUT', 'http://localhost/api/tournaments/t1/matches', { winnerId: 'm1' }),
      params('t1')
    );
    expect(res.status).toBe(400);
  });

  it('存在しないmatchIdは404', async () => {
    await seedMatch();
    const res = await PUT_MATCH(
      makeReq('PUT', 'http://localhost/api/tournaments/t1/matches', {
        matchId: 'nonexistent', winnerId: 'm1',
      }),
      params('t1')
    );
    expect(res.status).toBe(404);
  });
});
