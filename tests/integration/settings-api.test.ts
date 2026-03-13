/**
 * Integration: GET/PUT /api/settings
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { clubSettings, users } from '@/db/schema';

vi.mock('@/db', () => ({ db: testDb }));
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
  }),
}));

beforeEach(async () => {
  await resetDb();
  // テスト用クラブ設定を挿入
  await testDb.insert(users).values({
    id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin',
  });
  await testDb.insert(clubSettings).values({
    name: 'テストクラブ', substitutionDeadlineDays: 31,
  });
});

describe('GET /api/settings', () => {
  test('設定を取得できる', async () => {
    const { GET } = await import('@/app/api/settings/route');
    const res = await GET(new Request('http://localhost/api/settings'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.name).toBe('テストクラブ');
    expect(json.substitutionDeadlineDays).toBe(31);
    expect('lineChannelSecret' in json).toBe(false);
  });
});

describe('PUT /api/settings', () => {
  test('クラブ名と振替期限を更新できる', async () => {
    const { PUT } = await import('@/app/api/settings/route');
    const res = await PUT(new Request('http://localhost/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '更新クラブ', substitutionDeadlineDays: 45 }),
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.name).toBe('更新クラブ');
    expect(json.substitutionDeadlineDays).toBe(45);
  });

  test('LINE Access Token を更新できる', async () => {
    const { PUT } = await import('@/app/api/settings/route');
    const res = await PUT(new Request('http://localhost/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineChannelAccessToken: 'dummy-token-123' }),
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.lineChannelAccessToken).toBe('dummy-token-123');
    expect('lineChannelSecret' in json).toBe(false);
  });
});
