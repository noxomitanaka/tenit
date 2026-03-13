/**
 * Integration tests: 出席API群
 * - POST /api/lesson-slots/generate (定期スロット生成)
 * - GET/POST/DELETE /api/lesson-slots/[id]/attendance (出席打刻)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { members, lessons, lessonSlots, attendances, users } from '@/db/schema';

vi.mock('@/db', () => ({ db: testDb }));
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin' as const },
  }),
}));

const { POST: POST_GENERATE } = await import('@/app/api/lesson-slots/generate/route');
const { GET: GET_ATTENDANCE, POST: POST_ATTENDANCE, DELETE: DELETE_ATTENDANCE } =
  await import('@/app/api/lesson-slots/[id]/attendance/route');

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
  // auth mock が admin-1 を参照するため先に挿入
  await testDb.insert(users).values({
    id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin', hashedPassword: 'x',
  });
  await testDb.insert(members).values([
    { id: 'm1', name: '田中', status: 'active' },
    { id: 'm2', name: '鈴木', status: 'active' },
  ]);
  // 水曜（dayOfWeek=3）定期レッスン
  await testDb.insert(lessons).values({
    id: 'l1', title: '水曜クラス', startTime: '10:00', endTime: '11:30',
    type: 'lesson', isRecurring: true, recurringDayOfWeek: 3,
  });
  await testDb.insert(lessonSlots).values({
    id: 's1', lessonId: 'l1', date: '2026-04-01', startTime: '10:00', endTime: '11:30', status: 'open',
  });
}

beforeEach(async () => { await resetDb(); });

// ─── 定期スロット生成 ─────────────────────────────────

describe('POST /api/lesson-slots/generate', () => {
  it('水曜日のスロットのみ生成される', async () => {
    await seedBase();
    // 2026-04-06 (月) 〜 2026-04-19 (日) → 水曜は4/8, 4/15 の2回
    const res = await POST_GENERATE(makeReq('POST', 'http://localhost/api/lesson-slots/generate', {
      from: '2026-04-06', to: '2026-04-19',
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.created).toBe(2);
  });

  it('既存スロットは重複生成されない', async () => {
    await seedBase();
    // s1 は 2026-04-01 (水) に既に存在
    const res = await POST_GENERATE(makeReq('POST', 'http://localhost/api/lesson-slots/generate', {
      from: '2026-03-30', to: '2026-04-05',
    }));
    const json = await res.json();
    // 2026-04-01 は既存 → 0件
    expect(json.created).toBe(0);
  });

  it('from/to 未指定は400', async () => {
    const res = await POST_GENERATE(makeReq('POST', 'http://localhost/api/lesson-slots/generate', { from: '2026-04-01' }));
    expect(res.status).toBe(400);
  });

  it('90日超範囲は400', async () => {
    await seedBase();
    const res = await POST_GENERATE(makeReq('POST', 'http://localhost/api/lesson-slots/generate', {
      from: '2026-01-01', to: '2026-12-31',
    }));
    expect(res.status).toBe(400);
  });

  it('from > to は400', async () => {
    await seedBase();
    const res = await POST_GENERATE(makeReq('POST', 'http://localhost/api/lesson-slots/generate', {
      from: '2026-04-30', to: '2026-04-01',
    }));
    expect(res.status).toBe(400);
  });
});

// ─── 出席打刻 ────────────────────────────────────────

describe('GET /api/lesson-slots/[id]/attendance', () => {
  it('出席一覧を返す', async () => {
    await seedBase();
    await testDb.insert(attendances).values({
      id: 'a1', lessonSlotId: 's1', memberId: 'm1', method: 'manual',
    });
    const res = await GET_ATTENDANCE(makeReq('GET', 'http://localhost/api/lesson-slots/s1/attendance'), params('s1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].memberName).toBe('田中');
    expect(json[0].method).toBe('manual');
  });

  it('記録がない場合は空配列', async () => {
    await seedBase();
    const res = await GET_ATTENDANCE(makeReq('GET', 'http://localhost/api/lesson-slots/s1/attendance'), params('s1'));
    const json = await res.json();
    expect(json).toHaveLength(0);
  });
});

describe('POST /api/lesson-slots/[id]/attendance', () => {
  it('出席を手動打刻できる', async () => {
    await seedBase();
    const res = await POST_ATTENDANCE(
      makeReq('POST', 'http://localhost/api/lesson-slots/s1/attendance', { memberId: 'm1', method: 'manual' }),
      params('s1')
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.attendance.memberId).toBe('m1');
    expect(json.attendance.method).toBe('manual');
    expect(json.memberName).toBe('田中');
  });

  it('QR打刻できる', async () => {
    await seedBase();
    const res = await POST_ATTENDANCE(
      makeReq('POST', 'http://localhost/api/lesson-slots/s1/attendance', { memberId: 'm1', method: 'qr' }),
      params('s1')
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.attendance.method).toBe('qr');
  });

  it('重複打刻は409', async () => {
    await seedBase();
    await testDb.insert(attendances).values({
      id: 'a1', lessonSlotId: 's1', memberId: 'm1', method: 'manual',
    });
    const res = await POST_ATTENDANCE(
      makeReq('POST', 'http://localhost/api/lesson-slots/s1/attendance', { memberId: 'm1' }),
      params('s1')
    );
    expect(res.status).toBe(409);
  });

  it('存在しないスロットは404', async () => {
    await seedBase();
    const res = await POST_ATTENDANCE(
      makeReq('POST', 'http://localhost/api/lesson-slots/nonexistent/attendance', { memberId: 'm1' }),
      params('nonexistent')
    );
    expect(res.status).toBe(404);
  });

  it('存在しない会員は404', async () => {
    await seedBase();
    const res = await POST_ATTENDANCE(
      makeReq('POST', 'http://localhost/api/lesson-slots/s1/attendance', { memberId: 'nonexistent' }),
      params('s1')
    );
    expect(res.status).toBe(404);
  });

  it('memberId未指定は400', async () => {
    await seedBase();
    const res = await POST_ATTENDANCE(
      makeReq('POST', 'http://localhost/api/lesson-slots/s1/attendance', {}),
      params('s1')
    );
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/lesson-slots/[id]/attendance', () => {
  it('打刻を取り消せる', async () => {
    await seedBase();
    await testDb.insert(attendances).values({
      id: 'a1', lessonSlotId: 's1', memberId: 'm1', method: 'manual',
    });
    const res = await DELETE_ATTENDANCE(
      makeReq('DELETE', 'http://localhost/api/lesson-slots/s1/attendance?memberId=m1'),
      params('s1')
    );
    expect(res.status).toBe(200);
    const all = await testDb.select().from(attendances);
    expect(all).toHaveLength(0);
  });
});
