/**
 * Integration: POST /api/line/webhook
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { clubSettings, users, members } from '@/db/schema';
import { eq } from 'drizzle-orm';

vi.mock('@/db', () => ({ db: testDb }));
vi.mock('@/lib/line', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/line')>();
  return {
    ...actual,
    validateLineSignature: vi.fn().mockReturnValue(true),
  };
});

beforeEach(async () => {
  await resetDb();
  await testDb.insert(users).values({ id: 'a1', email: 'a@t.com', name: 'Admin', role: 'admin' });
  await testDb.insert(clubSettings).values({
    name: 'テストクラブ',
    lineChannelSecret: 'test-secret',
    substitutionDeadlineDays: 31,
  });
  await testDb.insert(members).values({
    id: 'mem-1', name: '田中花子', status: 'active',
  });
});

describe('POST /api/line/webhook', () => {
  test('LINE未設定ならば503を返す', async () => {
    await testDb.update(clubSettings).set({ lineChannelSecret: null });
    const { POST } = await import('@/app/api/line/webhook/route');
    const req = new Request('http://localhost/api/line/webhook', {
      method: 'POST',
      headers: { 'x-line-signature': 'sig' },
      body: JSON.stringify({ events: [] }),
    });
    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(res.status).toBe(503);
  });

  test('正常なwebhookでok:trueを返す', async () => {
    const { POST } = await import('@/app/api/line/webhook/route');
    const body = JSON.stringify({ events: [] });
    const req = new Request('http://localhost/api/line/webhook', {
      method: 'POST',
      headers: { 'x-line-signature': 'valid-sig' },
      body,
    });
    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  test('「リンク <会員ID>」メッセージで lineUserId が保存される', async () => {
    const { POST } = await import('@/app/api/line/webhook/route');
    const lineUserId = 'U_test_line_123';
    const body = JSON.stringify({
      events: [{
        type: 'message',
        source: { type: 'user', userId: lineUserId },
        message: { type: 'text', text: 'リンク mem-1' },
      }],
    });
    const req = new Request('http://localhost/api/line/webhook', {
      method: 'POST',
      headers: { 'x-line-signature': 'sig' },
      body,
    });
    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);
    const [m] = await testDb.select().from(members).where(eq(members.id, 'mem-1'));
    expect(m.lineUserId).toBe(lineUserId);
  });
});
