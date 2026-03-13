/**
 * Integration tests: /api/join (公開エンドポイント)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { members } from '@/db/schema';

vi.mock('@/db', () => ({ db: testDb }));

const { POST } = await import('@/app/api/join/route');

function makeReq(body: object) {
  return new Request('http://localhost/api/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => { await resetDb(); });

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

  it('重複メールアドレスは409エラー', async () => {
    await POST(makeReq({ name: '田中', email: 'dup@test.com' }));
    const res = await POST(makeReq({ name: '田中2', email: 'dup@test.com' }));
    expect(res.status).toBe(409);
  });
});
