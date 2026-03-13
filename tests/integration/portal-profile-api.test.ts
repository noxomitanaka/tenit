/**
 * Integration tests: /api/portal/profile (会員ポータル プロフィールAPI)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { users, members } from '@/db/schema';

vi.mock('@/db', () => ({ db: testDb }));
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'member@test.com', name: '田中', role: 'member' as const },
  }),
}));

const { GET, PATCH } = await import('@/app/api/portal/profile/route');

function makeReq(method: string, url: string, body?: object) {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function seedMember() {
  await testDb.insert(users).values({
    id: 'user-1', email: 'member@test.com', name: '田中', role: 'member', hashedPassword: 'x',
  });
  await testDb.insert(members).values({
    id: 'm1', userId: 'user-1', name: '田中太郎', nameKana: 'タナカタロウ',
    email: 'taro@test.com', phone: '090-1234-5678', level: 'beginner', status: 'active',
  });
}

beforeEach(async () => { await resetDb(); });

// ─── GET /api/portal/profile ───────────────────────────

describe('GET /api/portal/profile', () => {
  it('認証会員のプロフィールを返す', async () => {
    await seedMember();
    const res = await GET(makeReq('GET', 'http://localhost/api/portal/profile'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.name).toBe('田中太郎');
    expect(json.nameKana).toBe('タナカタロウ');
    expect(json.email).toBe('taro@test.com');
    expect(json.level).toBe('beginner');
  });

  it('会員レコードが存在しない場合は403', async () => {
    // users は挿入しない → requireMember が member を見つけられず 403
    const res = await GET(makeReq('GET', 'http://localhost/api/portal/profile'));
    expect(res.status).toBe(403);
  });
});

// ─── PATCH /api/portal/profile ────────────────────────

describe('PATCH /api/portal/profile', () => {
  it('プロフィールを更新できる', async () => {
    await seedMember();
    const res = await PATCH(makeReq('PATCH', 'http://localhost/api/portal/profile', {
      name: '田中次郎',
      nameKana: 'タナカジロウ',
      phone: '080-9999-8888',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.name).toBe('田中次郎');
    expect(json.nameKana).toBe('タナカジロウ');
    expect(json.phone).toBe('080-9999-8888');
  });

  it('name を空文字にしようとすると400', async () => {
    await seedMember();
    const res = await PATCH(makeReq('PATCH', 'http://localhost/api/portal/profile', { name: '  ' }));
    expect(res.status).toBe(400);
  });

  it('email を null にクリアできる', async () => {
    await seedMember();
    const res = await PATCH(makeReq('PATCH', 'http://localhost/api/portal/profile', { email: '' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.email).toBeNull();
  });

  it('nameKana を null にクリアできる', async () => {
    await seedMember();
    const res = await PATCH(makeReq('PATCH', 'http://localhost/api/portal/profile', { nameKana: '' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.nameKana).toBeNull();
  });
});
