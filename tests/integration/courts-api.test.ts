/**
 * Integration tests: /api/courts
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { courts } from '@/db/schema';

vi.mock('@/db', () => ({ db: testDb }));
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin' as const },
  }),
}));

const { GET, POST } = await import('@/app/api/courts/route');
const { PUT, DELETE } = await import('@/app/api/courts/[id]/route');

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

describe('GET /api/courts', () => {
  it('コートが存在しない場合は空配列', async () => {
    const json = await (await GET(makeReq('GET', 'http://localhost/api/courts'))).json();
    expect(json).toEqual([]);
  });

  it('コートリストをsortOrder順に返す', async () => {
    await testDb.insert(courts).values([
      { id: 'c2', name: 'B面', isIndoor: false, isActive: true, sortOrder: 2 },
      { id: 'c1', name: 'A面', isIndoor: false, isActive: true, sortOrder: 1 },
    ]);
    const json = await (await GET(makeReq('GET', 'http://localhost/api/courts'))).json();
    expect(json[0].name).toBe('A面');
  });
});

describe('POST /api/courts', () => {
  it('コートを作成できる', async () => {
    const res = await POST(makeReq('POST', 'http://localhost/api/courts', {
      name: 'センターコート', surface: 'hard', isIndoor: true,
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.name).toBe('センターコート');
    expect(json.isActive).toBe(true);
  });

  it('nameが空は400エラー', async () => {
    const res = await POST(makeReq('POST', 'http://localhost/api/courts', { name: '' }));
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/courts/[id]', () => {
  it('コート情報を更新できる', async () => {
    await testDb.insert(courts).values({ id: 'c1', name: 'A面', isIndoor: false, isActive: true, sortOrder: 0 });
    const res = await PUT(
      makeReq('PUT', 'http://localhost/api/courts/c1', { name: 'A面（改修後）' }),
      params('c1')
    );
    expect((await res.json()).name).toBe('A面（改修後）');
  });
});

describe('DELETE /api/courts/[id]', () => {
  it('コートをソフトデリート（isActive=false）できる', async () => {
    await testDb.insert(courts).values({ id: 'c1', name: 'B面', isIndoor: false, isActive: true, sortOrder: 0 });
    const res = await DELETE(makeReq('DELETE', 'http://localhost/api/courts/c1'), params('c1'));
    expect(res.status).toBe(200);
    expect((await res.json()).isActive).toBe(false);
  });
});
