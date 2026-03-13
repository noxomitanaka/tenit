/**
 * Integration tests: 月謝管理API群
 * - GET/POST /api/fees
 * - GET/PATCH/DELETE /api/fees/[id]
 * - POST /api/fees/generate
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { users, members, clubSettings, monthlyFees } from '@/db/schema';

vi.mock('@/db', () => ({ db: testDb }));
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin' as const },
  }),
}));

const { GET, POST } = await import('@/app/api/fees/route');
const { GET: GET_ID, PATCH, DELETE: DELETE_ID } = await import('@/app/api/fees/[id]/route');
const { POST: POST_GENERATE } = await import('@/app/api/fees/generate/route');

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

async function seedBase() {
  await testDb.insert(users).values({
    id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin', hashedPassword: 'x',
  });
  await testDb.insert(clubSettings).values({
    name: 'テストクラブ', defaultMonthlyFee: 8000,
  });
  await testDb.insert(members).values([
    { id: 'm1', name: '田中', status: 'active', monthlyFee: 10000 },
    { id: 'm2', name: '鈴木', status: 'active' }, // monthlyFee null → デフォルト8000
    { id: 'm3', name: '退会者', status: 'inactive' },
  ]);
}

beforeEach(async () => { await resetDb(); });

// ─── GET /api/fees ─────────────────────────────────────

describe('GET /api/fees', () => {
  it('月謝レコードがない場合は空配列', async () => {
    await seedBase();
    const res = await GET(makeReq('GET', 'http://localhost/api/fees'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('月でフィルタできる', async () => {
    await seedBase();
    await testDb.insert(monthlyFees).values([
      { id: 'f1', memberId: 'm1', month: '2026-03', amount: 10000, status: 'pending' },
      { id: 'f2', memberId: 'm1', month: '2026-04', amount: 10000, status: 'pending' },
    ]);
    const res = await GET(makeReq('GET', 'http://localhost/api/fees?month=2026-03'));
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].month).toBe('2026-03');
  });

  it('ステータスでフィルタできる', async () => {
    await seedBase();
    await testDb.insert(monthlyFees).values([
      { id: 'f1', memberId: 'm1', month: '2026-03', amount: 10000, status: 'pending' },
      { id: 'f2', memberId: 'm2', month: '2026-03', amount: 8000, status: 'paid' },
    ]);
    const res = await GET(makeReq('GET', 'http://localhost/api/fees?status=paid'));
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].status).toBe('paid');
  });

  it('memberName が含まれる', async () => {
    await seedBase();
    await testDb.insert(monthlyFees).values({
      id: 'f1', memberId: 'm1', month: '2026-03', amount: 10000, status: 'pending',
    });
    const json = await (await GET(makeReq('GET', 'http://localhost/api/fees'))).json();
    expect(json[0].memberName).toBe('田中');
  });
});

// ─── POST /api/fees ────────────────────────────────────

describe('POST /api/fees', () => {
  it('月謝レコードを作成できる', async () => {
    await seedBase();
    const res = await POST(makeReq('POST', 'http://localhost/api/fees', {
      memberId: 'm1', month: '2026-03', amount: 10000,
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.memberId).toBe('m1');
    expect(json.amount).toBe(10000);
    expect(json.status).toBe('pending');
  });

  it('month 形式不正は400', async () => {
    await seedBase();
    const res = await POST(makeReq('POST', 'http://localhost/api/fees', {
      memberId: 'm1', month: '2026/03', amount: 10000,
    }));
    expect(res.status).toBe(400);
  });

  it('amount 未指定は400', async () => {
    await seedBase();
    const res = await POST(makeReq('POST', 'http://localhost/api/fees', {
      memberId: 'm1', month: '2026-03',
    }));
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/fees/[id] ────────────────────────────────

describe('GET /api/fees/[id]', () => {
  it('存在するIDで詳細を返す', async () => {
    await seedBase();
    await testDb.insert(monthlyFees).values({
      id: 'f1', memberId: 'm1', month: '2026-03', amount: 10000, status: 'pending',
    });
    const res = await GET_ID(makeReq('GET', 'http://localhost/api/fees/f1'), params('f1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('f1');
    expect(json.memberName).toBe('田中');
  });

  it('存在しないIDは404', async () => {
    await seedBase();
    const res = await GET_ID(makeReq('GET', 'http://localhost/api/fees/none'), params('none'));
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/fees/[id] ──────────────────────────────

describe('PATCH /api/fees/[id]', () => {
  it('paid に変更すると paidAt が自動セットされる', async () => {
    await seedBase();
    await testDb.insert(monthlyFees).values({
      id: 'f1', memberId: 'm1', month: '2026-03', amount: 10000, status: 'pending',
    });
    const res = await PATCH(makeReq('PATCH', 'http://localhost/api/fees/f1', { status: 'paid' }), params('f1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('paid');
    expect(json.paidAt).not.toBeNull();
  });

  it('paid 以外に変更すると paidAt がクリアされる', async () => {
    await seedBase();
    await testDb.insert(monthlyFees).values({
      id: 'f1', memberId: 'm1', month: '2026-03', amount: 10000, status: 'paid',
      paidAt: new Date(),
    });
    const res = await PATCH(makeReq('PATCH', 'http://localhost/api/fees/f1', { status: 'pending' }), params('f1'));
    const json = await res.json();
    expect(json.status).toBe('pending');
    expect(json.paidAt).toBeNull();
  });

  it('無効なステータスは400', async () => {
    await seedBase();
    await testDb.insert(monthlyFees).values({
      id: 'f1', memberId: 'm1', month: '2026-03', amount: 10000, status: 'pending',
    });
    const res = await PATCH(makeReq('PATCH', 'http://localhost/api/fees/f1', { status: 'invalid' }), params('f1'));
    expect(res.status).toBe(400);
  });

  it('overdue に変更できる', async () => {
    await seedBase();
    await testDb.insert(monthlyFees).values({
      id: 'f1', memberId: 'm1', month: '2026-03', amount: 10000, status: 'pending',
    });
    const res = await PATCH(makeReq('PATCH', 'http://localhost/api/fees/f1', { status: 'overdue' }), params('f1'));
    const json = await res.json();
    expect(json.status).toBe('overdue');
  });
});

// ─── DELETE /api/fees/[id] ─────────────────────────────

describe('DELETE /api/fees/[id]', () => {
  it('月謝レコードを削除できる', async () => {
    await seedBase();
    await testDb.insert(monthlyFees).values({
      id: 'f1', memberId: 'm1', month: '2026-03', amount: 10000, status: 'pending',
    });
    const res = await DELETE_ID(makeReq('DELETE', 'http://localhost/api/fees/f1'), params('f1'));
    expect(res.status).toBe(200);
    const all = await testDb.select().from(monthlyFees);
    expect(all).toHaveLength(0);
  });
});

// ─── POST /api/fees/generate ───────────────────────────

describe('POST /api/fees/generate', () => {
  it('アクティブ会員分の月謝を一括生成できる', async () => {
    await seedBase();
    const res = await POST_GENERATE(makeReq('POST', 'http://localhost/api/fees/generate', {
      month: '2026-03',
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    // m1(active), m2(active) の2件。m3(inactive) は除外
    expect(json.created).toBe(2);
    expect(json.skipped).toBe(0);

    const fees = await testDb.select().from(monthlyFees);
    expect(fees).toHaveLength(2);
    const m1fee = fees.find(f => f.memberId === 'm1');
    const m2fee = fees.find(f => f.memberId === 'm2');
    expect(m1fee?.amount).toBe(10000); // 個別設定
    expect(m2fee?.amount).toBe(8000);  // デフォルト
  });

  it('既存レコードはスキップされる（冪等）', async () => {
    await seedBase();
    // 1回目
    await POST_GENERATE(makeReq('POST', 'http://localhost/api/fees/generate', { month: '2026-03' }));
    // 2回目
    const res = await POST_GENERATE(makeReq('POST', 'http://localhost/api/fees/generate', { month: '2026-03' }));
    const json = await res.json();
    expect(json.created).toBe(0);
    expect(json.skipped).toBe(2);
    // DBに重複なし
    const all = await testDb.select().from(monthlyFees);
    expect(all).toHaveLength(2);
  });

  it('month 未指定は400', async () => {
    const res = await POST_GENERATE(makeReq('POST', 'http://localhost/api/fees/generate', {}));
    expect(res.status).toBe(400);
  });

  it('month 形式不正は400', async () => {
    const res = await POST_GENERATE(makeReq('POST', 'http://localhost/api/fees/generate', {
      month: '2026/03',
    }));
    expect(res.status).toBe(400);
  });
});
