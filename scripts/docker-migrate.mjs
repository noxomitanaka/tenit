/**
 * コンテナ起動時にマイグレーションを適用する。
 * standalone 本番イメージには drizzle-kit が含まれないため、drizzle-orm の
 * migrator（drizzle-orm パッケージ内に同梱）で migrations/ を直接適用する。
 * これがないと fresh volume 起動時に全クエリが no such table で失敗する。
 */
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

const url = process.env.DATABASE_URL ?? 'file:./data/tenit.db';
const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder: './migrations' });
  console.log('[docker-migrate] migrations applied');
} catch (err) {
  console.error('[docker-migrate] migration failed:', err);
  process.exit(1);
}
