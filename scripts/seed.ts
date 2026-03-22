/**
 * Seed script — 初期データ投入
 * Usage: npx tsx scripts/seed.ts
 *
 * 環境変数 DATABASE_URL が未設定の場合は ./local.db に書き込む
 */
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { users, members, clubSettings, groups, courts, lessons } from '../src/db/schema';
import * as crypto from 'crypto';

const url = process.env.DATABASE_URL ?? 'file:./local.db';
const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
const db = drizzle(client);

// Simple bcrypt-style hash (using crypto for portability without bcrypt dep)
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  console.log(`Seeding database: ${url}`);

  // 1. クラブ設定
  const existingSettings = await db.select().from(clubSettings);
  if (existingSettings.length === 0) {
    await db.insert(clubSettings).values({
      id: 1,
      name: 'テニスクラブ',
      substitutionDeadlineDays: 31,
    });
    console.log('✓ Club settings created');
  } else {
    console.log('  Club settings already exist, skipping');
  }

  // 2. 管理者ユーザー
  const existingUsers = await db.select().from(users);
  if (existingUsers.length === 0) {
    const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin1234';
    const hashed = await hashPassword(adminPassword);
    await db.insert(users).values({
      id: 'admin-seed',
      email: process.env.ADMIN_EMAIL ?? 'admin@example.com',
      name: '管理者',
      role: 'admin',
      hashedPassword: hashed,
    });
    console.log(`✓ Admin user created (email: ${process.env.ADMIN_EMAIL ?? 'admin@example.com'})`);
    if (!process.env.ADMIN_PASSWORD) {
      console.log('  ⚠  Default password "admin1234" — change immediately after login!');
    }
  } else {
    console.log('  Users already exist, skipping admin creation');
  }

  // 3. コート
  const existingCourts = await db.select().from(courts);
  if (existingCourts.length === 0) {
    await db.insert(courts).values([
      { id: 'court-1', name: 'コート1', surface: 'hard' },
      { id: 'court-2', name: 'コート2', surface: 'hard' },
    ]);
    console.log('✓ Courts created (2 courts)');
  }

  // 4. グループ
  const existingGroups = await db.select().from(groups);
  if (existingGroups.length === 0) {
    await db.insert(groups).values([
      { id: 'group-beginner', name: '初級クラス' },
      { id: 'group-intermediate', name: '中級クラス' },
      { id: 'group-advanced', name: '上級クラス' },
    ]);
    console.log('✓ Groups created (beginner / intermediate / advanced)');
  }

  // 5. サンプルレッスン（毎週月曜）
  const existingLessons = await db.select().from(lessons);
  if (existingLessons.length === 0) {
    await db.insert(lessons).values([
      {
        id: 'lesson-mon-1',
        title: '初級クラス（月）',
        type: 'lesson',
        startTime: '10:00',
        endTime: '11:30',
        recurringDayOfWeek: 1,
        isRecurring: true,
        courtId: 'court-1',
        groupId: 'group-beginner',
        maxParticipants: 8,
      },
      {
        id: 'lesson-wed-1',
        title: '中級クラス（水）',
        type: 'lesson',
        startTime: '19:00',
        endTime: '20:30',
        recurringDayOfWeek: 3,
        isRecurring: true,
        courtId: 'court-2',
        groupId: 'group-intermediate',
        maxParticipants: 8,
      },
    ]);
    console.log('✓ Sample lessons created');
  }

  // 6. サンプル会員
  const existingMembers = await db.select().from(members);
  if (existingMembers.length === 0) {
    await db.insert(members).values([
      { id: 'member-demo-1', name: '山田 太郎', email: 'yamada@example.com', level: 'beginner', status: 'active', joinedAt: new Date() },
      { id: 'member-demo-2', name: '佐藤 花子', email: 'sato@example.com', level: 'intermediate', status: 'active', joinedAt: new Date() },
    ]);
    console.log('✓ Sample members created (2 members)');
  }

  console.log('\nSeed complete!');
  client.close();
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
