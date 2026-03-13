/**
 * Integration tests: /api/reservations + /api/substitution-credits
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { lessons, lessonSlots, members, reservations, clubSettings, substitutionCredits } from '@/db/schema';

vi.mock('@/db', () => ({ db: testDb }));
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin' as const },
  }),
}));

const { GET, POST } = await import('@/app/api/reservations/route');
const { PATCH } = await import('@/app/api/reservations/[id]/route');
const { GET: GET_CREDITS } = await import('@/app/api/substitution-credits/route');

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

// テスト用フィクスチャ
async function seedFixtures() {
  await testDb.insert(clubSettings).values({ id: 1, name: 'テストクラブ', substitutionDeadlineDays: 31 });
  await testDb.insert(members).values({ id: 'm1', name: '田中', status: 'active' });
  await testDb.insert(lessons).values({
    id: 'l1', title: 'テスト', startTime: '10:00', endTime: '11:00',
    type: 'lesson', isRecurring: false,
  });
  await testDb.insert(lessonSlots).values({
    id: 's1', lessonId: 'l1', date: '2026-04-07', startTime: '10:00', endTime: '11:00', status: 'open',
  });
}

beforeEach(async () => { await resetDb(); });

describe('GET /api/reservations', () => {
  it('予約が存在しない場合は空配列', async () => {
    const res = await GET(makeReq('GET', 'http://localhost/api/reservations'));
    expect(await res.json()).toEqual([]);
  });
});

describe('POST /api/reservations', () => {
  it('予約を作成できる', async () => {
    await seedFixtures();
    const res = await POST(makeReq('POST', 'http://localhost/api/reservations', {
      lessonSlotId: 's1', memberId: 'm1',
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.status).toBe('confirmed');
    expect(json.isSubstitution).toBe(false);
  });

  it('必須フィールド不足は400エラー', async () => {
    const res = await POST(makeReq('POST', 'http://localhost/api/reservations', { lessonSlotId: 's1' }));
    expect(res.status).toBe(400);
  });

  it('存在しないスロットは404', async () => {
    await seedFixtures();
    const res = await POST(makeReq('POST', 'http://localhost/api/reservations', {
      lessonSlotId: 'nonexistent', memberId: 'm1',
    }));
    expect(res.status).toBe(404);
  });

  it('同じスロットへの重複予約は409', async () => {
    await seedFixtures();
    await POST(makeReq('POST', 'http://localhost/api/reservations', { lessonSlotId: 's1', memberId: 'm1' }));
    const res = await POST(makeReq('POST', 'http://localhost/api/reservations', { lessonSlotId: 's1', memberId: 'm1' }));
    expect(res.status).toBe(409);
  });

  it('キャンセル済みスロットへの予約は409', async () => {
    await seedFixtures();
    await testDb.update(lessonSlots).set({ status: 'cancelled' });
    const res = await POST(makeReq('POST', 'http://localhost/api/reservations', { lessonSlotId: 's1', memberId: 'm1' }));
    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/reservations/[id]', () => {
  it('予約をキャンセルできる', async () => {
    await seedFixtures();
    await testDb.insert(reservations).values({
      id: 'r1', lessonSlotId: 's1', memberId: 'm1', status: 'confirmed', isSubstitution: false,
    });
    const res = await PATCH(
      makeReq('PATCH', 'http://localhost/api/reservations/r1', { status: 'cancelled' }),
      params('r1')
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reservation.status).toBe('cancelled');
  });

  it('通常予約キャンセル時に振替クレジットが発行される', async () => {
    await seedFixtures();
    await testDb.insert(reservations).values({
      id: 'r1', lessonSlotId: 's1', memberId: 'm1', status: 'confirmed', isSubstitution: false,
    });
    const res = await PATCH(
      makeReq('PATCH', 'http://localhost/api/reservations/r1', { status: 'cancelled' }),
      params('r1')
    );
    const json = await res.json();
    expect(json.credit).not.toBeNull();
    expect(json.credit.memberId).toBe('m1');
    expect(new Date(json.credit.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('欠席時も振替クレジットが発行される', async () => {
    await seedFixtures();
    await testDb.insert(reservations).values({
      id: 'r1', lessonSlotId: 's1', memberId: 'm1', status: 'confirmed', isSubstitution: false,
    });
    const json = await (await PATCH(
      makeReq('PATCH', 'http://localhost/api/reservations/r1', { status: 'absent' }),
      params('r1')
    )).json();
    expect(json.credit).not.toBeNull();
  });

  it('振替予約キャンセル時はクレジットが発行されない', async () => {
    await seedFixtures();
    await testDb.insert(reservations).values({
      id: 'r1', lessonSlotId: 's1', memberId: 'm1', status: 'confirmed', isSubstitution: true,
    });
    const json = await (await PATCH(
      makeReq('PATCH', 'http://localhost/api/reservations/r1', { status: 'cancelled' }),
      params('r1')
    )).json();
    expect(json.credit).toBeNull();
  });

  it('無効なstatusは400エラー', async () => {
    await seedFixtures();
    await testDb.insert(reservations).values({
      id: 'r1', lessonSlotId: 's1', memberId: 'm1', status: 'confirmed', isSubstitution: false,
    });
    const res = await PATCH(
      makeReq('PATCH', 'http://localhost/api/reservations/r1', { status: 'invalid' }),
      params('r1')
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /api/substitution-credits', () => {
  it('会員の有効クレジットを返す', async () => {
    await seedFixtures();
    await testDb.insert(substitutionCredits).values({
      id: 'cr1', memberId: 'm1', expiresAt: new Date(Date.now() + 86400000),
    });
    const res = await GET_CREDITS(makeReq('GET', 'http://localhost/api/substitution-credits?memberId=m1&active=true'));
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].memberId).toBe('m1');
  });
});
