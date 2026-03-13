/**
 * Playwright グローバルセットアップ
 * E2Eテスト実行前にtest.dbのマイグレーションを適用する
 */
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';
import path from 'path';

export default async function globalSetup() {
  const dbPath = path.resolve(process.cwd(), 'test.db');
  const client = createClient({ url: `file:${dbPath}` });
  const db = drizzle(client);

  await migrate(db, {
    migrationsFolder: path.resolve(process.cwd(), 'migrations'),
  });

  client.close();
  console.log('[E2E setup] test.db migration applied');
}
