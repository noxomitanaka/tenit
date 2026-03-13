/**
 * Integration tests: /api/lessons + /api/lesson-slots
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { lessons, lessonSlots } from '@/db/schema';

vi.mock('@/db', () => ({ db: testDb }));
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin' as const },
  }),
}));

const { GET: GET_LESSONS, POST: POST_LESSON } = await import('@/app/api/lessons/route');
const { DELETE: DELETE_LESSON } = await import('@/app/api/lessons/[id]/route');
const { GET: GET_SLOTS, POST: POST_SLOT } = await import('@/app/api/lesson-slots/route');
const { PATCH: PATCH_SLOT } = await import('@/app/api/lesson-slots/[id]/route');

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

describe('POST /api/lessons', () => {
  it('レッスンを作成できる', async () => {
    const res = await POST_LESSON(makeReq('POST', 'http://localhost/api/lessons', {
      title: '初級クラス', startTime: '10:00', endTime: '11:30',
      isRecurring: true, recurringDayOfWeek: 1, // 月曜
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.title).toBe('初級クラス');
    expect(json.isRecurring).toBe(true);
  });

  it('titleが空は400エラー', async () => {
    const res = await POST_LESSON(makeReq('POST', 'http://localhost/api/lessons', {
      startTime: '10:00', endTime: '11:00',
    }));
    expect(res.status).toBe(400);
  });

  it('startTime未指定は400エラー', async () => {
    const res = await POST_LESSON(makeReq('POST', 'http://localhost/api/lessons', {
      title: 'テスト', endTime: '11:00',
    }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/lessons', () => {
  it('レッスンリストを返す', async () => {
    await testDb.insert(lessons).values({
      id: 'l1', title: '中級', startTime: '14:00', endTime: '15:30',
      type: 'lesson', isRecurring: false,
    });
    const json = await (await GET_LESSONS(makeReq('GET', 'http://localhost/api/lessons'))).json();
    expect(json).toHaveLength(1);
  });
});

describe('DELETE /api/lessons/[id]', () => {
  it('レッスンを削除できる', async () => {
    await testDb.insert(lessons).values({
      id: 'l1', title: '削除予定', startTime: '10:00', endTime: '11:00',
      type: 'lesson', isRecurring: false,
    });
    const res = await DELETE_LESSON(makeReq('DELETE', 'http://localhost/api/lessons/l1'), params('l1'));
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe(true);
  });
});

describe('POST /api/lesson-slots - 単体作成', () => {
  it('スロットを単体作成できる', async () => {
    await testDb.insert(lessons).values({
      id: 'l1', title: 'テスト', startTime: '10:00', endTime: '11:00',
      type: 'lesson', isRecurring: false,
    });
    const res = await POST_SLOT(makeReq('POST', 'http://localhost/api/lesson-slots', {
      lessonId: 'l1', date: '2026-04-07', startTime: '10:00', endTime: '11:00',
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.date).toBe('2026-04-07');
    expect(json.status).toBe('open');
  });

  it('必須フィールド不足は400エラー', async () => {
    const res = await POST_SLOT(makeReq('POST', 'http://localhost/api/lesson-slots', {
      lessonId: 'l1', date: '2026-04-07', // startTime/endTime 欠如
    }));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/lesson-slots - バッチ生成（繰り返し）', () => {
  it('繰り返しレッスンの月次スロットを一括生成できる', async () => {
    // 月曜日のレッスン
    await testDb.insert(lessons).values({
      id: 'l1', title: '月曜クラス', startTime: '10:00', endTime: '11:00',
      type: 'lesson', isRecurring: true, recurringDayOfWeek: 1, // Monday
    });

    const res = await POST_SLOT(makeReq('POST', 'http://localhost/api/lesson-slots', {
      lessonId: 'l1', from: '2026-04-01', to: '2026-04-30',
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    // 4月の月曜日: 4/6, 4/13, 4/20, 4/27 → 4件
    expect(json).toHaveLength(4);
    expect(json[0].date).toBe('2026-04-06');
  });

  it('非繰り返しレッスンへのバッチ生成は400エラー', async () => {
    await testDb.insert(lessons).values({
      id: 'l2', title: '単発', startTime: '10:00', endTime: '11:00',
      type: 'lesson', isRecurring: false,
    });
    const res = await POST_SLOT(makeReq('POST', 'http://localhost/api/lesson-slots', {
      lessonId: 'l2', from: '2026-04-01', to: '2026-04-30',
    }));
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/lesson-slots/[id]', () => {
  it('スロットをキャンセルできる', async () => {
    await testDb.insert(lessons).values({
      id: 'l1', title: 'T', startTime: '10:00', endTime: '11:00',
      type: 'lesson', isRecurring: false,
    });
    await testDb.insert(lessonSlots).values({
      id: 's1', lessonId: 'l1', date: '2026-04-06', startTime: '10:00', endTime: '11:00', status: 'open',
    });
    const res = await PATCH_SLOT(
      makeReq('PATCH', 'http://localhost/api/lesson-slots/s1', { status: 'cancelled', cancelReason: '雨天' }),
      params('s1')
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('cancelled');
    expect(json.cancelReason).toBe('雨天');
  });
});
