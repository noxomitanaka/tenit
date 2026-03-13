/**
 * Integration tests: /api/dashboard/stats
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { members, lessons, lessonSlots, reservations, substitutionCredits } from '@/db/schema';

vi.mock('@/db', () => ({ db: testDb }));
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin' as const },
  }),
}));

const { GET } = await import('@/app/api/dashboard/stats/route');

function makeReq() {
  return new Request('http://localhost/api/dashboard/stats', { method: 'GET' });
}

beforeEach(async () => { await resetDb(); });

describe('GET /api/dashboard/stats', () => {
  it('データなしの場合はゼロ値を返す', async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.activeMembers).toBe(0);
    expect(json.todayReservations).toBe(0);
    expect(json.pendingSubstitutions).toBe(0);
    expect(json.monthlyUtilization).toBeNull();
  });

  it('アクティブ会員数が正しく集計される', async () => {
    await testDb.insert(members).values([
      { id: 'm1', name: 'A', status: 'active' },
      { id: 'm2', name: 'B', status: 'active' },
      { id: 'm3', name: 'C', status: 'inactive' },
    ]);
    const json = await (await GET(makeReq())).json();
    expect(json.activeMembers).toBe(2);
  });

  it('今日の予約数が正しく集計される', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await testDb.insert(members).values({ id: 'm1', name: 'A', status: 'active' });
    await testDb.insert(lessons).values({
      id: 'l1', title: 'T', startTime: '10:00', endTime: '11:00', type: 'lesson', isRecurring: false,
    });
    await testDb.insert(lessonSlots).values({
      id: 's1', lessonId: 'l1', date: today, startTime: '10:00', endTime: '11:00', status: 'open',
    });
    await testDb.insert(reservations).values({
      id: 'r1', lessonSlotId: 's1', memberId: 'm1', status: 'confirmed', isSubstitution: false,
    });

    const json = await (await GET(makeReq())).json();
    expect(json.todayReservations).toBe(1);
  });

  it('振替クレジット数（有効期限内・未使用）が正しく集計される', async () => {
    await testDb.insert(members).values({ id: 'm1', name: 'A', status: 'active' });
    await testDb.insert(substitutionCredits).values([
      { id: 'cr1', memberId: 'm1', expiresAt: new Date(Date.now() + 86400000) }, // 有効
      { id: 'cr2', memberId: 'm1', expiresAt: new Date(Date.now() - 86400000) }, // 期限切れ
      { id: 'cr3', memberId: 'm1', expiresAt: new Date(Date.now() + 86400000), usedAt: new Date() }, // 使用済み
    ]);

    const json = await (await GET(makeReq())).json();
    expect(json.pendingSubstitutions).toBe(1); // cr1のみ
  });
});
