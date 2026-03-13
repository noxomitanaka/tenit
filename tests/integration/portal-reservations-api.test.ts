/**
 * Integration tests: /api/portal/reservations (会員ポータル予約API)
 * auth() をモック + DB にユーザー・会員を挿入することで requireMember() を通す
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { members, lessons, lessonSlots, reservations, substitutionCredits, users } from '@/db/schema';

vi.mock('@/db', () => ({ db: testDb }));
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'member@test.com', name: '田中', role: 'member' as const },
  }),
}));

// email/LINE通知をモック（外部サービス呼び出しを回避）
vi.mock('@/lib/notifications', () => ({
  notifyReservationConfirmed: vi.fn().mockResolvedValue(undefined),
  notifyReservationCancelled: vi.fn().mockResolvedValue(undefined),
}));

const { GET, POST } = await import('@/app/api/portal/reservations/route');
const { DELETE } = await import('@/app/api/portal/reservations/[id]/route');

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

async function seedFixtures() {
  // user + member (userId = 'user-1' で requireMember が通る)
  await testDb.insert(users).values({
    id: 'user-1', email: 'member@test.com', name: '田中', role: 'member', hashedPassword: 'x',
  });
  await testDb.insert(members).values({
    id: 'm1', userId: 'user-1', name: '田中', status: 'active',
  });
  await testDb.insert(lessons).values({
    id: 'l1', title: 'テストレッスン', startTime: '10:00', endTime: '11:00',
    type: 'lesson', isRecurring: false,
  });
  await testDb.insert(lessonSlots).values({
    id: 's1', lessonId: 'l1', date: '2026-04-10', startTime: '10:00', endTime: '11:00', status: 'open',
  });
}

beforeEach(async () => { await resetDb(); });

// ─── GET ─────────────────────────────────────────────

describe('GET /api/portal/reservations', () => {
  it('自分の予約一覧を返す', async () => {
    await seedFixtures();
    await testDb.insert(reservations).values({
      id: 'r1', lessonSlotId: 's1', memberId: 'm1', status: 'confirmed', isSubstitution: false,
    });
    const res = await GET(makeReq('GET', 'http://localhost/api/portal/reservations'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].lessonTitle).toBe('テストレッスン');
    expect(json[0].date).toBe('2026-04-10');
  });

  it('予約がない場合は空配列', async () => {
    await seedFixtures();
    const res = await GET(makeReq('GET', 'http://localhost/api/portal/reservations'));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(0);
  });
});

// ─── POST ────────────────────────────────────────────

describe('POST /api/portal/reservations', () => {
  it('レッスン枠を予約できる', async () => {
    await seedFixtures();
    const res = await POST(makeReq('POST', 'http://localhost/api/portal/reservations', {
      lessonSlotId: 's1',
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.status).toBe('confirmed');
    expect(json.isSubstitution).toBe(false);
    expect(json.memberId).toBe('m1');
  });

  it('振替クレジットを使用した予約ができる', async () => {
    await seedFixtures();
    await testDb.insert(substitutionCredits).values({
      id: 'cr1', memberId: 'm1', expiresAt: new Date(Date.now() + 86400000),
    });
    const res = await POST(makeReq('POST', 'http://localhost/api/portal/reservations', {
      lessonSlotId: 's1', isSubstitution: true, creditId: 'cr1',
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.isSubstitution).toBe(true);
  });

  it('lessonSlotId未指定は400', async () => {
    await seedFixtures();
    const res = await POST(makeReq('POST', 'http://localhost/api/portal/reservations', {}));
    expect(res.status).toBe(400);
  });

  it('存在しないスロットは404', async () => {
    await seedFixtures();
    const res = await POST(makeReq('POST', 'http://localhost/api/portal/reservations', {
      lessonSlotId: 'nonexistent',
    }));
    expect(res.status).toBe(404);
  });

  it('オープンでないスロットは409', async () => {
    await seedFixtures();
    await testDb.update(lessonSlots).set({ status: 'cancelled' });
    const res = await POST(makeReq('POST', 'http://localhost/api/portal/reservations', {
      lessonSlotId: 's1',
    }));
    expect(res.status).toBe(409);
  });

  it('同じスロットへの重複予約は409', async () => {
    await seedFixtures();
    await testDb.insert(reservations).values({
      id: 'r1', lessonSlotId: 's1', memberId: 'm1', status: 'confirmed', isSubstitution: false,
    });
    const res = await POST(makeReq('POST', 'http://localhost/api/portal/reservations', {
      lessonSlotId: 's1',
    }));
    expect(res.status).toBe(409);
  });
});

// ─── DELETE ──────────────────────────────────────────

describe('DELETE /api/portal/reservations/[id]', () => {
  it('自分の予約をキャンセルできる', async () => {
    await seedFixtures();
    await testDb.insert(reservations).values({
      id: 'r1', lessonSlotId: 's1', memberId: 'm1', status: 'confirmed', isSubstitution: false,
    });
    const res = await DELETE(
      makeReq('DELETE', 'http://localhost/api/portal/reservations/r1'),
      params('r1')
    );
    expect(res.status).toBe(200);
    const [r] = await testDb.select().from(reservations);
    expect(r.status).toBe('cancelled');
  });

  it('通常予約キャンセルで振替クレジットが発行される', async () => {
    await seedFixtures();
    await testDb.insert(reservations).values({
      id: 'r1', lessonSlotId: 's1', memberId: 'm1', status: 'confirmed', isSubstitution: false,
    });
    await DELETE(
      makeReq('DELETE', 'http://localhost/api/portal/reservations/r1'),
      params('r1')
    );
    const credits = await testDb.select().from(substitutionCredits);
    expect(credits).toHaveLength(1);
    expect(credits[0].memberId).toBe('m1');
  });

  it('振替予約キャンセルではクレジットが発行されない', async () => {
    await seedFixtures();
    await testDb.insert(reservations).values({
      id: 'r1', lessonSlotId: 's1', memberId: 'm1', status: 'confirmed', isSubstitution: true,
    });
    await DELETE(
      makeReq('DELETE', 'http://localhost/api/portal/reservations/r1'),
      params('r1')
    );
    const credits = await testDb.select().from(substitutionCredits);
    expect(credits).toHaveLength(0);
  });

  it('存在しない予約は404', async () => {
    await seedFixtures();
    const res = await DELETE(
      makeReq('DELETE', 'http://localhost/api/portal/reservations/nonexistent'),
      params('nonexistent')
    );
    expect(res.status).toBe(404);
  });

  it('他会員の予約には404（存在を隠蔽するセキュリティパターン）', async () => {
    await seedFixtures();
    await testDb.insert(members).values({ id: 'm2', name: '鈴木', status: 'active' });
    await testDb.insert(reservations).values({
      id: 'r1', lessonSlotId: 's1', memberId: 'm2', status: 'confirmed', isSubstitution: false,
    });
    const res = await DELETE(
      makeReq('DELETE', 'http://localhost/api/portal/reservations/r1'),
      params('r1')
    );
    expect(res.status).toBe(404);
  });
});
