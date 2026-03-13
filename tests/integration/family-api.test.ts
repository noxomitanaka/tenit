/**
 * Integration tests: 家族アカウントAPI
 * GET/POST/DELETE /api/members/[id]/family
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { users, members } from '@/db/schema';

vi.mock('@/db', () => ({ db: testDb }));
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin' as const },
  }),
}));

const { GET, POST, DELETE } = await import('@/app/api/members/[id]/family/route');

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
  await testDb.insert(users).values({
    id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin', hashedPassword: 'x',
  });
  await testDb.insert(members).values([
    { id: 'parent', name: '田中太郎', status: 'active' },
    { id: 'child1', name: '田中一郎', status: 'active' },
    { id: 'child2', name: '田中二郎', status: 'active' },
  ]);
}

beforeEach(async () => { await resetDb(); });

describe('GET /api/members/[id]/family', () => {
  it('家族メンバーがいない場合は空配列', async () => {
    await seedMembers();
    const res = await GET(makeReq('GET', 'http://localhost/api/members/parent/family'), params('parent'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.children).toHaveLength(0);
    expect(json.parent.id).toBe('parent');
  });

  it('紐付け済みの子会員一覧を返す', async () => {
    await seedMembers();
    // child1 を parent に紐付け
    await testDb.insert(members).values({ id: 'c1', name: 'テスト', status: 'active', parentMemberId: 'parent' });
    const res = await GET(makeReq('GET', 'http://localhost/api/members/parent/family'), params('parent'));
    const json = await res.json();
    expect(json.children).toHaveLength(1);
  });

  it('存在しない親会員は404', async () => {
    await seedMembers();
    const res = await GET(makeReq('GET', 'http://localhost/api/members/none/family'), params('none'));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/members/[id]/family', () => {
  it('子会員を紐付けできる', async () => {
    await seedMembers();
    const res = await POST(
      makeReq('POST', 'http://localhost/api/members/parent/family', { childId: 'child1' }),
      params('parent')
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.parentMemberId).toBe('parent');
  });

  it('複数の子会員を紐付けできる', async () => {
    await seedMembers();
    await POST(makeReq('POST', 'http://localhost/api/members/parent/family', { childId: 'child1' }), params('parent'));
    const res = await POST(makeReq('POST', 'http://localhost/api/members/parent/family', { childId: 'child2' }), params('parent'));
    expect(res.status).toBe(201);
  });

  it('自分自身への紐付けは400', async () => {
    await seedMembers();
    const res = await POST(
      makeReq('POST', 'http://localhost/api/members/parent/family', { childId: 'parent' }),
      params('parent')
    );
    expect(res.status).toBe(400);
  });

  it('childId 未指定は400', async () => {
    await seedMembers();
    const res = await POST(
      makeReq('POST', 'http://localhost/api/members/parent/family', {}),
      params('parent')
    );
    expect(res.status).toBe(400);
  });

  it('存在しない子会員は404', async () => {
    await seedMembers();
    const res = await POST(
      makeReq('POST', 'http://localhost/api/members/parent/family', { childId: 'nonexistent' }),
      params('parent')
    );
    expect(res.status).toBe(404);
  });

  it('既に別の親に紐付いている場合は409', async () => {
    await seedMembers();
    await testDb.insert(members).values({ id: 'other-parent', name: '別の親', status: 'active' });
    // child1 を other-parent に紐付け
    await POST(makeReq('POST', 'http://localhost/api/members/other-parent/family', { childId: 'child1' }), params('other-parent'));
    // parent からも紐付けしようとする → 409
    const res = await POST(makeReq('POST', 'http://localhost/api/members/parent/family', { childId: 'child1' }), params('parent'));
    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/members/[id]/family', () => {
  it('紐付けを解除できる', async () => {
    await seedMembers();
    await POST(makeReq('POST', 'http://localhost/api/members/parent/family', { childId: 'child1' }), params('parent'));
    const res = await DELETE(
      makeReq('DELETE', 'http://localhost/api/members/parent/family?childId=child1'),
      params('parent')
    );
    expect(res.status).toBe(200);
    // parentMemberId が null に戻る
    const all = await testDb.select().from(members);
    const child = all.find(m => m.id === 'child1');
    expect(child?.parentMemberId).toBeNull();
  });

  it('紐付いていない子は404', async () => {
    await seedMembers();
    const res = await DELETE(
      makeReq('DELETE', 'http://localhost/api/members/parent/family?childId=child1'),
      params('parent')
    );
    expect(res.status).toBe(404);
  });

  it('childId クエリパラメータ未指定は400', async () => {
    await seedMembers();
    const res = await DELETE(
      makeReq('DELETE', 'http://localhost/api/members/parent/family'),
      params('parent')
    );
    expect(res.status).toBe(400);
  });
});
