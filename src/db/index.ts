import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

// DATABASE_URL が未設定の場合はローカルSQLiteファイルを使用
// 例: file:./local.db (開発) / libsql://... (Turso) / postgresql://... (別途設定)
const url = process.env.DATABASE_URL ?? 'file:./local.db';

const client = createClient({ url });

export const db = drizzle(client, { schema });
export type DB = typeof db;

/**
 * drizzle-orm 0.45.x + libsql: .returning() resolves to `any[] | ResultSet`
 * due to an unresolved conditional type. At runtime it always yields a row array.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asRows<T = any>(result: unknown): T[] {
  return result as T[];
}
