/**
 * Integration tests: GET /api/portal/credits (会員ポータル 振替クレジットAPI)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { users, members, substitutionCredits } from '@/db/schema';

vi.mock('@/db', () => ({ db: testDb }));
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'member@test.com', name: '田中', role: 'member' as const },
  }),
}));

const { GET } = await import('@/app/api/portal/credits/route');

function makeReq() {
  return new Request('http://localhost/api/portal/credits', { method: 'GET' });
}

async function seedMember() {
  await testDb.insert(users).values({
    id: 'user-1', email: 'member@test.com', name: '田中', role: 'member', hashedPassword: 'x',
  });
  await testDb.insert(members).values({
    id: 'm1', userId: 'user-1', name: '田中太郎', status: 'active',
  });
}

beforeEach(async () => { await resetDb(); });

describe('GET /api/portal/credits', () => {
  it('クレジットがない場合は空配列', async () => {
    await seedMember();
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual([]);
  });

  it('有効なクレジットは isActive=true', async () => {
    await seedMember();
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30日後
    await testDb.insert(substitutionCredits).values({
      id: 'c1', memberId: 'm1', expiresAt: futureDate,
    });
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].isActive).toBe(true);
    expect(json[0].isExpired).toBe(false);
    expect(json[0].isUsed).toBe(false);
  });

  it('期限切れクレジットは isExpired=true', async () => {
    await seedMember();
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 昨日
    await testDb.insert(substitutionCredits).values({
      id: 'c2', memberId: 'm1', expiresAt: pastDate,
    });
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json[0].isActive).toBe(false);
    expect(json[0].isExpired).toBe(true);
  });

  it('使用済みクレジットは isUsed=true', async () => {
    await seedMember();
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await testDb.insert(substitutionCredits).values({
      id: 'c3', memberId: 'm1', expiresAt: futureDate, usedAt: new Date(),
    });
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json[0].isUsed).toBe(true);
    expect(json[0].isActive).toBe(false);
  });

  it('他の会員のクレジットは取得されない', async () => {
    await seedMember();
    // 別会員を追加
    await testDb.insert(members).values({ id: 'm2', name: '別の人', status: 'active' });
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await testDb.insert(substitutionCredits).values([
      { id: 'c-mine', memberId: 'm1', expiresAt: futureDate },
      { id: 'c-other', memberId: 'm2', expiresAt: futureDate },
    ]);
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].id).toBe('c-mine');
  });
});
