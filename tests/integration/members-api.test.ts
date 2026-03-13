/**
 * Integration tests: /api/members
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { members } from '@/db/schema';

vi.mock('@/db', () => ({ db: testDb }));
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin' as const },
  }),
}));

const { GET, POST } = await import('@/app/api/members/route');
const { GET: GET_ID, PUT, DELETE } = await import('@/app/api/members/[id]/route');

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

describe('GET /api/members', () => {
  it('会員が存在しない場合は空配列を返す', async () => {
    const res = await GET(makeReq('GET', 'http://localhost/api/members'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('会員リストを返す', async () => {
    await testDb.insert(members).values({
      id: 'm1', name: '田中花子', status: 'active',
    });
    const res = await GET(makeReq('GET', 'http://localhost/api/members'));
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].name).toBe('田中花子');
  });

  it('status=active フィルタが動作する', async () => {
    await testDb.insert(members).values([
      { id: 'm1', name: 'アクティブ', status: 'active' },
      { id: 'm2', name: '退会済み', status: 'inactive' },
    ]);
    const res = await GET(makeReq('GET', 'http://localhost/api/members?status=active'));
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].name).toBe('アクティブ');
  });
});

describe('POST /api/members', () => {
  it('会員を正常に作成できる', async () => {
    const res = await POST(makeReq('POST', 'http://localhost/api/members', {
      name: '鈴木一郎',
      email: 'suzuki@test.com',
      level: 'intermediate',
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.name).toBe('鈴木一郎');
    expect(json.status).toBe('active');
    expect(json.id).toBeTruthy();
  });

  it('nameが空の場合は400エラー', async () => {
    const res = await POST(makeReq('POST', 'http://localhost/api/members', { name: '' }));
    expect(res.status).toBe(400);
  });

  it('nameが未指定の場合は400エラー', async () => {
    const res = await POST(makeReq('POST', 'http://localhost/api/members', { email: 'a@b.com' }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/members/[id]', () => {
  it('存在する会員を返す', async () => {
    await testDb.insert(members).values({ id: 'm1', name: '佐藤次郎', status: 'active' });
    const res = await GET_ID(makeReq('GET', 'http://localhost/api/members/m1'), params('m1'));
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe('佐藤次郎');
  });

  it('存在しない場合は404', async () => {
    const res = await GET_ID(makeReq('GET', 'http://localhost/api/members/none'), params('none'));
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/members/[id]', () => {
  it('会員情報を更新できる', async () => {
    await testDb.insert(members).values({ id: 'm1', name: '田中', status: 'active' });
    const res = await PUT(
      makeReq('PUT', 'http://localhost/api/members/m1', { name: '田中（更新）' }),
      params('m1')
    );
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe('田中（更新）');
  });

  it('存在しないIDは404', async () => {
    const res = await PUT(makeReq('PUT', 'http://localhost/api/members/xx', { name: 'A' }), params('xx'));
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/members/[id]', () => {
  it('会員をソフトデリート（inactive）できる', async () => {
    await testDb.insert(members).values({ id: 'm1', name: 'テスト', status: 'active' });
    const res = await DELETE(makeReq('DELETE', 'http://localhost/api/members/m1'), params('m1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('inactive');
  });

  it('存在しないIDは404', async () => {
    const res = await DELETE(makeReq('DELETE', 'http://localhost/api/members/xx'), params('xx'));
    expect(res.status).toBe(404);
  });
});
