/**
 * Integration tests: /api/setup ルートハンドラ
 *
 * テスト戦略: ルートハンドラを直接importし、インメモリSQLiteで実行。
 * NextResponseをシミュレートするため標準のRequest/Responseを使用。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { users, clubSettings } from '@/db/schema';
import { count } from 'drizzle-orm';

// @/db をテスト用DBに差し替え
vi.mock('@/db', () => ({ db: testDb }));

// モック後にルートハンドラをimport（モックが先に必要）
const { POST } = await import('@/app/api/setup/route');

/** テスト用ヘルパー: POSTリクエストを作成 */
function makeRequest(body: Record<string, string>) {
  return new Request('http://localhost:3000/api/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/setup', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('正常系', () => {
    it('クラブ名・管理者情報で初回セットアップが成功する', async () => {
      const res = await POST(makeRequest({
        clubName: 'テストテニスクラブ',
        adminEmail: 'admin@test.com',
        adminPassword: 'password123',
        adminName: '田中管理者',
      }));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('セットアップ後にusersテーブルに管理者が1件存在する', async () => {
      await POST(makeRequest({
        clubName: 'テストクラブ',
        adminEmail: 'admin@test.com',
        adminPassword: 'pass1234',
        adminName: '管理者',
      }));

      const [{ value }] = await testDb.select({ value: count() }).from(users);
      expect(value).toBe(1);
    });

    it('セットアップ後にclub_settingsが1件存在する', async () => {
      await POST(makeRequest({
        clubName: '桜テニスクラブ',
        adminEmail: 'admin@sakura.com',
        adminPassword: 'secure123',
        adminName: '佐藤',
      }));

      const [{ value }] = await testDb.select({ value: count() }).from(clubSettings);
      expect(value).toBe(1);
    });

    it('管理者ユーザーのroleが"admin"である', async () => {
      await POST(makeRequest({
        clubName: 'クラブ',
        adminEmail: 'coach@test.com',
        adminPassword: 'pass5678',
        adminName: '鈴木',
      }));

      const createdUsers = await testDb.select().from(users);
      expect(createdUsers[0].role).toBe('admin');
    });

    it('パスワードがハッシュ化されて保存される（平文でない）', async () => {
      const plainPassword = 'mysecretpass';
      await POST(makeRequest({
        clubName: 'クラブ',
        adminEmail: 'admin@hash.com',
        adminPassword: plainPassword,
        adminName: 'テスト',
      }));

      const [user] = await testDb.select().from(users);
      expect(user.hashedPassword).not.toBe(plainPassword);
      expect(user.hashedPassword?.startsWith('$2b$')).toBe(true); // bcrypt hash
    });
  });

  describe('異常系: 重複セットアップ', () => {
    it('2回目のセットアップは400エラーを返す', async () => {
      const payload = {
        clubName: 'クラブ',
        adminEmail: 'admin@test.com',
        adminPassword: 'pass1234',
        adminName: '管理者',
      };
      await POST(makeRequest(payload));

      const res2 = await POST(makeRequest({
        ...payload,
        adminEmail: 'admin2@test.com',
      }));

      expect(res2.status).toBe(400);
      const json = await res2.json();
      expect(json.error).toContain('既に完了');
    });
  });

  describe('異常系: バリデーション', () => {
    it('clubNameが空の場合は400エラー', async () => {
      const res = await POST(makeRequest({
        clubName: '',
        adminEmail: 'admin@test.com',
        adminPassword: 'pass1234',
        adminName: '管理者',
      }));
      expect(res.status).toBe(400);
    });

    it('adminEmailが空の場合は400エラー', async () => {
      const res = await POST(makeRequest({
        clubName: 'クラブ',
        adminEmail: '',
        adminPassword: 'pass1234',
        adminName: '管理者',
      }));
      expect(res.status).toBe(400);
    });

    it('adminPasswordが空の場合は400エラー', async () => {
      const res = await POST(makeRequest({
        clubName: 'クラブ',
        adminEmail: 'admin@test.com',
        adminPassword: '',
        adminName: '管理者',
      }));
      expect(res.status).toBe(400);
    });

    it('adminNameが空の場合は400エラー', async () => {
      const res = await POST(makeRequest({
        clubName: 'クラブ',
        adminEmail: 'admin@test.com',
        adminPassword: 'pass1234',
        adminName: '',
      }));
      expect(res.status).toBe(400);
    });
  });
});
