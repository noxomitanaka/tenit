/**
 * Integration tests: /api/broadcast (一斉配信API)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { members, broadcastMessages, users } from '@/db/schema';

vi.mock('@/db', () => ({ db: testDb }));
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin' as const },
  }),
}));

// メール/LINEを完全モック
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/line', () => ({
  sendLinePush: vi.fn().mockResolvedValue(undefined),
}));

const { GET, POST } = await import('@/app/api/broadcast/route');

function makeReq(method: string, url: string, body?: object) {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function seedMembers() {
  // auth mock が admin-1 を参照するため先に挿入
  await testDb.insert(users).values({
    id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin', hashedPassword: 'x',
  });
  await testDb.insert(members).values([
    { id: 'm1', name: '田中', email: 'tanaka@test.com', status: 'active' },
    { id: 'm2', name: '鈴木', email: 'suzuki@test.com', status: 'active' },
    { id: 'm3', name: '退会者', email: 'left@test.com', status: 'inactive' },
  ]);
}

beforeEach(async () => { await resetDb(); });

describe('GET /api/broadcast', () => {
  it('配信履歴がない場合は空配列', async () => {
    const res = await GET(makeReq('GET', 'http://localhost/api/broadcast'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('配信履歴を返す', async () => {
    await testDb.insert(broadcastMessages).values({
      id: 'b1', subject: 'テスト配信', body: '本文', channel: 'email',
      targetType: 'all', sentCount: 2,
    });
    const json = await (await GET(makeReq('GET', 'http://localhost/api/broadcast'))).json();
    expect(json).toHaveLength(1);
    expect(json[0].subject).toBe('テスト配信');
  });
});

describe('POST /api/broadcast', () => {
  it('全会員にメール配信できる', async () => {
    await seedMembers();
    const res = await POST(makeReq('POST', 'http://localhost/api/broadcast', {
      subject: 'クラブからのお知らせ',
      message: '本文内容です',
      channel: 'email',
      targetType: 'all',
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.subject).toBe('クラブからのお知らせ');
    // active会員のみ（m3 inactive は除外）、メールアドレスあり → 2件
    expect(json.sentCount).toBe(2);
  });

  it('配信記録がDBに保存される', async () => {
    await seedMembers();
    await POST(makeReq('POST', 'http://localhost/api/broadcast', {
      subject: '記録テスト', message: '本文', channel: 'email', targetType: 'all',
    }));
    const records = await testDb.select().from(broadcastMessages);
    expect(records).toHaveLength(1);
    expect(records[0].subject).toBe('記録テスト');
    expect(records[0].channel).toBe('email');
  });

  it('subject未指定は400', async () => {
    const res = await POST(makeReq('POST', 'http://localhost/api/broadcast', {
      message: '本文', channel: 'email', targetType: 'all',
    }));
    expect(res.status).toBe(400);
  });

  it('無効なchannel指定は400', async () => {
    const res = await POST(makeReq('POST', 'http://localhost/api/broadcast', {
      subject: 'テスト', message: '本文', channel: 'sms', targetType: 'all',
    }));
    expect(res.status).toBe(400);
  });

  it('対象会員0名の場合は400', async () => {
    await testDb.insert(users).values({ id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin', hashedPassword: 'x' });
    // inactive会員のみ
    await testDb.insert(members).values({ id: 'm1', name: '退会者', status: 'inactive' });
    const res = await POST(makeReq('POST', 'http://localhost/api/broadcast', {
      subject: 'テスト', message: '本文', channel: 'email', targetType: 'all',
    }));
    expect(res.status).toBe(400);
  });

  it('メールなし会員はカウントされない', async () => {
    await testDb.insert(users).values({ id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin', hashedPassword: 'x' });
    await testDb.insert(members).values([
      { id: 'm1', name: 'メールなし', status: 'active' }, // emailなし
      { id: 'm2', name: 'メールあり', email: 'has@test.com', status: 'active' },
    ]);
    const json = await (await POST(makeReq('POST', 'http://localhost/api/broadcast', {
      subject: 'テスト', message: '本文', channel: 'email', targetType: 'all',
    }))).json();
    expect(json.sentCount).toBe(1);
  });
});
