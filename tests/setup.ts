/**
 * Vitest グローバルセットアップ
 * 各テストファイルの前にインメモリDBを初期化する
 */
import { beforeAll, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from '@/db/schema';
import path from 'path';

// テスト用インメモリDB（各テストプロセスで共有）
const testClient = createClient({ url: 'file::memory:?cache=shared' });
export const testDb = drizzle(testClient, { schema });

beforeAll(async () => {
  // マイグレーションを適用してスキーマを構築
  await migrate(testDb, {
    migrationsFolder: path.resolve(process.cwd(), 'migrations'),
  });
});

afterAll(async () => {
  testClient.close();
});
