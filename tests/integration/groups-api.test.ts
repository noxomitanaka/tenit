/**
 * Integration tests: /api/groups
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { groups } from '@/db/schema';

vi.mock('@/db', () => ({ db: testDb }));
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin' as const },
  }),
}));

const { GET, POST } = await import('@/app/api/groups/route');
const { GET: GET_ID, PUT, DELETE } = await import('@/app/api/groups/[id]/route');

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

beforeEach(async () => { await resetDb(); });

describe('GET /api/groups', () => {
  it('グループが存在しない場合は空配列', async () => {
    const res = await GET(makeReq('GET', 'http://localhost/api/groups'));
    expect(await res.json()).toEqual([]);
  });

  it('sortOrder順に返す', async () => {
    await testDb.insert(groups).values([
      { id: 'g2', name: '中級', sortOrder: 2 },
      { id: 'g1', name: '初級', sortOrder: 1 },
    ]);
    const json = await (await GET(makeReq('GET', 'http://localhost/api/groups'))).json();
    expect(json[0].name).toBe('初級');
    expect(json[1].name).toBe('中級');
  });
});

describe('POST /api/groups', () => {
  it('グループを作成できる', async () => {
    const res = await POST(makeReq('POST', 'http://localhost/api/groups', {
      name: '上級クラス', level: 'advanced', sortOrder: 3,
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.name).toBe('上級クラス');
    expect(json.level).toBe('advanced');
  });

  it('nameが空は400エラー', async () => {
    const res = await POST(makeReq('POST', 'http://localhost/api/groups', { name: '' }));
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/groups/[id]', () => {
  it('グループを更新できる', async () => {
    await testDb.insert(groups).values({ id: 'g1', name: '旧名前', sortOrder: 0 });
    const res = await PUT(
      makeReq('PUT', 'http://localhost/api/groups/g1', { name: '新名前' }),
      params('g1')
    );
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe('新名前');
  });
});

describe('DELETE /api/groups/[id]', () => {
  it('グループを削除できる', async () => {
    await testDb.insert(groups).values({ id: 'g1', name: '削除予定', sortOrder: 0 });
    const res = await DELETE(makeReq('DELETE', 'http://localhost/api/groups/g1'), params('g1'));
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe(true);

    const remaining = await testDb.select().from(groups);
    expect(remaining).toHaveLength(0);
  });

  it('存在しないIDは404', async () => {
    const res = await DELETE(makeReq('DELETE', 'http://localhost/api/groups/xx'), params('xx'));
    expect(res.status).toBe(404);
  });
});
