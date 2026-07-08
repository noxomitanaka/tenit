/**
 * Integration tests: PATCH /api/lesson-slots/[id] の休講カスケード。
 * 監査 #37（スロット cancelled でも confirmed 予約が残存・クレジット未発行）への対応。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { lessons, lessonSlots, members, reservations, clubSettings, substitutionCredits } from '@/db/schema';
import { eq } from 'drizzle-orm';

vi.mock('@/db', () => ({ db: testDb, asRows: <T>(r: T[]) => r }));
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'admin-1', name: 'Admin', role: 'admin' as const },
  }),
}));

const { PATCH } = await import('@/app/api/lesson-slots/[id]/route');

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}
function makeReq(body: object) {
  return new Request('http://localhost/api/lesson-slots/x', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function seed() {
  await testDb.insert(clubSettings).values({ id: 1, name: 'club', substitutionDeadlineDays: 31 });
  await testDb.insert(members).values([
    { id: 'm1', name: '田中', status: 'active' },
    { id: 'm2', name: '鈴木', status: 'active' },
  ]);
  await testDb.insert(lessons).values({
    id: 'l1', title: 'テスト', startTime: '10:00', endTime: '11:00', type: 'lesson', isRecurring: false,
  });
  await testDb.insert(lessonSlots).values({
    id: 's1', lessonId: 'l1', date: '2099-01-01', startTime: '10:00', endTime: '11:00', status: 'open',
  });
}

beforeEach(async () => { await resetDb(); });

describe('PATCH /api/lesson-slots/[id] 休講カスケード', () => {
  it('cancelled 化で confirmed 予約が一括キャンセルされ、通常予約にクレジットが発行される', async () => {
    await seed();
    await testDb.insert(reservations).values([
      { id: 'r1', lessonSlotId: 's1', memberId: 'm1', status: 'confirmed', isSubstitution: false },
      { id: 'r2', lessonSlotId: 's1', memberId: 'm2', status: 'confirmed', isSubstitution: false },
    ]);

    const res = await PATCH(makeReq({ status: 'cancelled', cancelReason: '雨天' }), params('s1'));
    expect(res.status).toBe(200);

    // 全 confirmed 予約が cancelled 化
    const rsv = await testDb.select().from(reservations);
    expect(rsv.every(r => r.status === 'cancelled')).toBe(true);

    // 各会員に振替クレジットが発行される
    const credits = await testDb.select().from(substitutionCredits);
    expect(credits).toHaveLength(2);
  });

  it('振替予約は消費済みクレジットが返却される', async () => {
    await seed();
    await testDb.insert(reservations).values({
      id: 'r1', lessonSlotId: 's1', memberId: 'm1', status: 'confirmed', isSubstitution: true,
    });
    // r1 が消費した振替クレジット
    await testDb.insert(substitutionCredits).values({
      id: 'cr1', memberId: 'm1', expiresAt: new Date(Date.now() + 86400000),
      usedAt: new Date(), usedReservationId: 'r1',
    });

    await PATCH(makeReq({ status: 'cancelled' }), params('s1'));

    // クレジットが未使用に戻る
    const [credit] = await testDb.select().from(substitutionCredits).where(eq(substitutionCredits.id, 'cr1'));
    expect(credit.usedAt).toBeNull();
    expect(credit.usedReservationId).toBeNull();
  });

  it('通常のステータス更新（open のまま cancelReason 変更）では予約に影響しない', async () => {
    await seed();
    await testDb.insert(reservations).values({
      id: 'r1', lessonSlotId: 's1', memberId: 'm1', status: 'confirmed', isSubstitution: false,
    });
    await PATCH(makeReq({ status: 'completed' }), params('s1'));
    const [r] = await testDb.select().from(reservations);
    expect(r.status).toBe('confirmed');
    const credits = await testDb.select().from(substitutionCredits);
    expect(credits).toHaveLength(0);
  });
});
