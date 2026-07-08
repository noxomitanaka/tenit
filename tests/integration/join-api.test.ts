/**
 * Integration tests: /api/join (公開エンドポイント)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { members } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { __resetRateLimit } from '@/lib/rate-limit';

vi.mock('@/db', () => ({ db: testDb, asRows: <T>(r: T[]) => r }));

const { POST } = await import('@/app/api/join/route');

function makeReq(body: object) {
  return new Request('http://localhost/api/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => { await resetDb(); __resetRateLimit(); });

describe('POST /api/join', () => {
  it('入会申請でstatus=inactiveの会員が作成される', async () => {
    const res = await POST(makeReq({ name: '新入会者', email: 'new@tennis.com', level: 'beginner' }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.message).toContain('申請');

    const all = await testDb.select().from(members);
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('inactive');
    expect(all[0].email).toBe('new@tennis.com');
  });

  it('nameが空は400エラー', async () => {
    const res = await POST(makeReq({ name: '', email: 'x@y.com' }));
    expect(res.status).toBe(400);
  });

  it('emailが空は400エラー', async () => {
    const res = await POST(makeReq({ name: '田中', email: '' }));
    expect(res.status).toBe(400);
  });

  it('重複メールでも成功応答を返す（メール列挙対策・重複作成なし）', async () => {
    await POST(makeReq({ name: '田中', email: 'dup@test.com' }));
    const res = await POST(makeReq({ name: '田中2', email: 'dup@test.com' }));
    // 存在を明かさないため 201。DB には重複作成されない。
    expect(res.status).toBe(201);
    const rows = await testDb.select().from(members).where(eq(members.email, 'dup@test.com'));
    expect(rows).toHaveLength(1);
  });

  it('不正なメール形式は400', async () => {
    const res = await POST(makeReq({ name: '田中', email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });

  it('不正なlevelは400', async () => {
    const res = await POST(makeReq({ name: '田中', email: 'ok@test.com', level: 'master' }));
    expect(res.status).toBe(400);
  });
});
