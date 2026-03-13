/**
 * Integration tests: 通知API群
 * - POST /api/notifications/reminder
 * - POST /api/notifications/overdue
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { users, members, lessons, lessonSlots, reservations, monthlyFees } from '@/db/schema';

vi.mock('@/db', () => ({ db: testDb }));
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin' as const },
  }),
}));

// 外部メール送信をモック
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

const { POST: POST_REMINDER } = await import('@/app/api/notifications/reminder/route');
const { POST: POST_OVERDUE } = await import('@/app/api/notifications/overdue/route');

import { sendEmail } from '@/lib/email';

function makeReq(method: string, url: string, body?: object) {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function seedAdmin() {
  await testDb.insert(users).values({
    id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin', hashedPassword: 'x',
  });
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

// ─── POST /api/notifications/reminder ─────────────────

describe('POST /api/notifications/reminder', () => {
  it('対象日のレッスンがない場合は sent=0', async () => {
    await seedAdmin();
    const res = await POST_REMINDER(makeReq('POST', 'http://localhost/api/notifications/reminder', {
      date: '2099-01-01',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(0);
  });

  it('確定予約のある会員にリマインドを送信する', async () => {
    await seedAdmin();
    await testDb.insert(members).values({
      id: 'm1', name: '田中', email: 'tanaka@test.com', status: 'active',
    });
    await testDb.insert(lessons).values({
      id: 'l1', title: 'テストレッスン', startTime: '10:00', endTime: '11:00',
      type: 'lesson', isRecurring: false,
    });
    await testDb.insert(lessonSlots).values({
      id: 's1', lessonId: 'l1', date: '2026-04-10', startTime: '10:00', endTime: '11:00', status: 'open',
    });
    await testDb.insert(reservations).values({
      id: 'r1', memberId: 'm1', lessonSlotId: 's1', status: 'confirmed',
    });

    const res = await POST_REMINDER(makeReq('POST', 'http://localhost/api/notifications/reminder', {
      date: '2026-04-10',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(1);
    expect(json.errors).toHaveLength(0);
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('メールアドレスなしの会員はスキップされる', async () => {
    await seedAdmin();
    await testDb.insert(members).values({
      id: 'm1', name: '田中', status: 'active', // email なし
    });
    await testDb.insert(lessons).values({
      id: 'l1', title: 'テストレッスン', startTime: '10:00', endTime: '11:00',
      type: 'lesson', isRecurring: false,
    });
    await testDb.insert(lessonSlots).values({
      id: 's1', lessonId: 'l1', date: '2026-04-10', startTime: '10:00', endTime: '11:00', status: 'open',
    });
    await testDb.insert(reservations).values({
      id: 'r1', memberId: 'm1', lessonSlotId: 's1', status: 'confirmed',
    });

    const res = await POST_REMINDER(makeReq('POST', 'http://localhost/api/notifications/reminder', {
      date: '2026-04-10',
    }));
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('非管理者は401', async () => {
    const { auth } = await import('@/auth');
    vi.mocked(auth).mockResolvedValueOnce(null);
    const res = await POST_REMINDER(makeReq('POST', 'http://localhost/api/notifications/reminder'));
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/notifications/overdue ──────────────────

describe('POST /api/notifications/overdue', () => {
  it('対象月より前の pending を overdue に更新する', async () => {
    await seedAdmin();
    await testDb.insert(members).values({ id: 'm1', name: '田中', status: 'active' });
    await testDb.insert(monthlyFees).values([
      { id: 'f1', memberId: 'm1', month: '2025-12', amount: 10000, status: 'pending' },
      { id: 'f2', memberId: 'm1', month: '2026-01', amount: 10000, status: 'pending' },
      { id: 'f3', memberId: 'm1', month: '2026-03', amount: 10000, status: 'pending' }, // 当月: スキップ
    ]);

    const res = await POST_OVERDUE(makeReq('POST', 'http://localhost/api/notifications/overdue', {
      beforeMonth: '2026-03',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.updated).toBe(2);
    expect(json.months).toContain('2025-12');
    expect(json.months).toContain('2026-01');
    expect(json.months).not.toContain('2026-03');
  });

  it('既に paid や waived のものは変更されない', async () => {
    await seedAdmin();
    await testDb.insert(members).values({ id: 'm1', name: '田中', status: 'active' });
    await testDb.insert(monthlyFees).values([
      { id: 'f1', memberId: 'm1', month: '2025-12', amount: 10000, status: 'paid' },
      { id: 'f2', memberId: 'm1', month: '2025-12', amount: 10000, status: 'waived' },
    ]);

    const res = await POST_OVERDUE(makeReq('POST', 'http://localhost/api/notifications/overdue', {
      beforeMonth: '2026-03',
    }));
    const json = await res.json();
    expect(json.updated).toBe(0);
  });

  it('beforeMonth 形式不正は400', async () => {
    await seedAdmin();
    const res = await POST_OVERDUE(makeReq('POST', 'http://localhost/api/notifications/overdue', {
      beforeMonth: '2026/03',
    }));
    expect(res.status).toBe(400);
  });

  it('beforeMonth 省略時は今月を基準にする', async () => {
    await seedAdmin();
    await testDb.insert(members).values({ id: 'm1', name: '田中', status: 'active' });
    const prevMonth = new Date();
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevMonthStr = prevMonth.toISOString().slice(0, 7);
    await testDb.insert(monthlyFees).values({
      id: 'f1', memberId: 'm1', month: prevMonthStr, amount: 10000, status: 'pending',
    });

    const res = await POST_OVERDUE(makeReq('POST', 'http://localhost/api/notifications/overdue'));
    const json = await res.json();
    expect(json.updated).toBe(1);
  });
});
