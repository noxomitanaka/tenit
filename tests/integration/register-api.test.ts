/**
 * Integration tests: /api/auth/register (会員セルフ登録API)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { users, members } from '@/db/schema';

vi.mock('@/db', () => ({ db: testDb }));

const { POST } = await import('@/app/api/auth/register/route');

function makeReq(body?: object) {
  return new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

beforeEach(async () => { await resetDb(); });

describe('POST /api/auth/register', () => {
  it('ユーザーと会員を同時に作成できる', async () => {
    const res = await POST(makeReq({
      name: '田中花子',
      email: 'hanako@test.com',
      password: 'password123',
      phone: '090-1234-5678',
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.memberId).toBeTruthy();

    // DBに記録されているか確認
    const allUsers = await testDb.select().from(users);
    expect(allUsers).toHaveLength(1);
    expect(allUsers[0].email).toBe('hanako@test.com');
    expect(allUsers[0].role).toBe('member');

    const allMembers = await testDb.select().from(members);
    expect(allMembers).toHaveLength(1);
    expect(allMembers[0].name).toBe('田中花子');
    expect(allMembers[0].phone).toBe('090-1234-5678');
    expect(allMembers[0].status).toBe('active');
  });

  it('パスワードがハッシュ化されて保存される', async () => {
    await POST(makeReq({ name: 'テスト', email: 'test@test.com', password: 'password123' }));
    const [user] = await testDb.select().from(users);
    expect(user.hashedPassword).not.toBe('password123');
    expect(user.hashedPassword).toBeTruthy();
  });

  it('メール重複は409', async () => {
    await POST(makeReq({ name: '田中', email: 'dup@test.com', password: 'password123' }));
    const res = await POST(makeReq({ name: '鈴木', email: 'dup@test.com', password: 'password456' }));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain('already registered');
  });

  it('name未指定は400', async () => {
    const res = await POST(makeReq({ email: 'test@test.com', password: 'password123' }));
    expect(res.status).toBe(400);
  });

  it('email未指定は400', async () => {
    const res = await POST(makeReq({ name: 'テスト', password: 'password123' }));
    expect(res.status).toBe(400);
  });

  it('password未指定は400', async () => {
    const res = await POST(makeReq({ name: 'テスト', email: 'test@test.com' }));
    expect(res.status).toBe(400);
  });

  it('パスワード7文字以下は400', async () => {
    const res = await POST(makeReq({ name: 'テスト', email: 'test@test.com', password: 'short' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('8 characters');
  });

  it('phone任意: phoneなしでも登録できる', async () => {
    const res = await POST(makeReq({ name: 'テスト', email: 'nophone@test.com', password: 'password123' }));
    expect(res.status).toBe(201);
    const [member] = await testDb.select().from(members);
    expect(member.phone).toBeNull();
  });
});
