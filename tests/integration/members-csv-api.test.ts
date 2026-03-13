/**
 * Integration tests: 会員 CSV エクスポート・インポートAPI
 * GET  /api/members/export
 * POST /api/members/import
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { users, members } from '@/db/schema';

vi.mock('@/db', () => ({ db: testDb }));
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin' as const },
  }),
}));

const { GET: GET_EXPORT } = await import('@/app/api/members/export/route');
const { POST: POST_IMPORT } = await import('@/app/api/members/import/route');

function params(_id: string) {
  return { params: Promise.resolve({ id: _id }) };
}

async function seedAdmin() {
  await testDb.insert(users).values({
    id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin', hashedPassword: 'x',
  });
}

function makeCsvUpload(csvContent: string): Request {
  const file = new File([csvContent], 'members.csv', { type: 'text/csv' });
  const formData = new FormData();
  formData.append('file', file);
  return new Request('http://localhost/api/members/import', {
    method: 'POST',
    body: formData,
  });
}

beforeEach(async () => { await resetDb(); });

// ─── CSV エクスポート ──────────────────────────────────

describe('GET /api/members/export', () => {
  it('会員データをCSVで返す', async () => {
    await seedAdmin();
    await testDb.insert(members).values([
      { id: 'm1', name: '田中太郎', email: 'tanaka@test.com', status: 'active' },
      { id: 'm2', name: '鈴木花子', email: 'suzuki@test.com', status: 'inactive' },
    ]);
    const res = await GET_EXPORT(new Request('http://localhost/api/members/export'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    const text = await res.text();
    expect(text).toContain('田中太郎');
    expect(text).toContain('鈴木花子');
  });

  it('status フィルタが効く', async () => {
    await seedAdmin();
    await testDb.insert(members).values([
      { id: 'm1', name: '田中太郎', status: 'active' },
      { id: 'm2', name: '退会者', status: 'inactive' },
    ]);
    const res = await GET_EXPORT(new Request('http://localhost/api/members/export?status=active'));
    const text = await res.text();
    expect(text).toContain('田中太郎');
    expect(text).not.toContain('退会者');
  });

  it('ヘッダ行を含む', async () => {
    await seedAdmin();
    const res = await GET_EXPORT(new Request('http://localhost/api/members/export'));
    const text = await res.text();
    expect(text.split('\n')[0]).toContain('name');
  });

  it('会員0件でもヘッダのみ返す', async () => {
    await seedAdmin();
    const res = await GET_EXPORT(new Request('http://localhost/api/members/export'));
    expect(res.status).toBe(200);
    const lines = (await res.text()).trim().split('\n');
    expect(lines).toHaveLength(1); // ヘッダのみ
  });
});

// ─── CSV インポート ────────────────────────────────────

describe('POST /api/members/import', () => {
  it('会員を一括インポートできる', async () => {
    await seedAdmin();
    const csv = `name,email,level,status
田中太郎,tanaka@test.com,beginner,active
鈴木花子,suzuki@test.com,intermediate,active`;
    const res = await POST_IMPORT(makeCsvUpload(csv));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.inserted).toBe(2);
    expect(json.skipped).toBe(0);
    expect(json.errors).toHaveLength(0);
    const all = await testDb.select().from(members);
    expect(all).toHaveLength(2);
  });

  it('重複メールアドレスはスキップされる', async () => {
    await seedAdmin();
    await testDb.insert(members).values({
      id: 'm1', name: '既存', email: 'existing@test.com', status: 'active',
    });
    const csv = `name,email,level
既存の人,existing@test.com,beginner
新規の人,new@test.com,beginner`;
    const res = await POST_IMPORT(makeCsvUpload(csv));
    const json = await res.json();
    expect(json.inserted).toBe(1);
    expect(json.skipped).toBe(1);
  });

  it('name なしの行はエラーになる', async () => {
    await seedAdmin();
    const csv = `name,email
,no-name@test.com`;
    const res = await POST_IMPORT(makeCsvUpload(csv));
    const json = await res.json();
    expect(json.errors).toHaveLength(1);
    expect(json.errors[0].row).toBe(2);
  });

  it('無効な level はエラー', async () => {
    await seedAdmin();
    const csv = `name,email,level
テスト,test@test.com,invalid_level`;
    const res = await POST_IMPORT(makeCsvUpload(csv));
    const json = await res.json();
    expect(json.errors).toHaveLength(1);
  });

  it('file フィールドなしは400', async () => {
    await seedAdmin();
    const formData = new FormData();
    const res = await POST_IMPORT(new Request('http://localhost/api/members/import', {
      method: 'POST', body: formData,
    }));
    expect(res.status).toBe(400);
  });

  it('ヘッダに name がない場合は400', async () => {
    await seedAdmin();
    const csv = `email,level
test@test.com,beginner`;
    const res = await POST_IMPORT(makeCsvUpload(csv));
    expect(res.status).toBe(400);
  });
});
