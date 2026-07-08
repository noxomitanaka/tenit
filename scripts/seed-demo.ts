/**
 * Demo seed — 体験用のログイン可能アカウントとサンプルデータを投入する。
 * Usage: npx tsx scripts/seed-demo.ts   (空DBを前提。日次リセットで drop→migrate→本script)
 *
 * 作成するログインアカウント（パスワードは全て demo1234）:
 *   - admin@demo.example.com   role=admin   （全機能）
 *   - staff@demo.example.com   role=staff   （会員・予約閲覧）
 *   - member@demo.example.com  role=member  （会員ポータル）
 */
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import {
  users, members, clubSettings, groups, courts, lessons, lessonSlots,
  reservations, substitutionCredits,
} from '../src/db/schema';
import { hashPassword } from '../src/lib/password';

const url = process.env.DATABASE_URL ?? 'file:./demo.db';
const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
const db = drizzle(client);

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'demo1234';

/** 今日から days 日後の YYYY-MM-DD（ローカル日付）。 */
function futureDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function main() {
  console.log(`Seeding DEMO database: ${url}`);
  const pw = await hashPassword(DEMO_PASSWORD);

  // 1. クラブ設定
  await db.insert(clubSettings).values({
    id: 1,
    name: 'Cobe Tennis（デモ）',
    substitutionDeadlineDays: 31,
    cancellationDeadlineHours: 24,
    defaultMonthlyFee: 8000,
  });

  // 2. ログインアカウント（admin / staff / member）
  await db.insert(users).values([
    { id: 'demo-admin', email: 'admin@demo.example.com', name: 'デモ管理者', role: 'admin', hashedPassword: pw },
    { id: 'demo-staff', email: 'staff@demo.example.com', name: 'デモスタッフ', role: 'staff', hashedPassword: pw },
    { id: 'demo-member', email: 'member@demo.example.com', name: 'デモ会員', role: 'member', hashedPassword: pw },
  ]);

  // 3. コート・グループ
  await db.insert(courts).values([
    { id: 'court-1', name: 'コート1', surface: 'hard' },
    { id: 'court-2', name: 'コート2', surface: 'clay' },
  ]);
  await db.insert(groups).values([
    { id: 'group-beginner', name: '初級クラス' },
    { id: 'group-intermediate', name: '中級クラス' },
  ]);

  // 4. 会員（member ログインに紐付く1名 + サンプル数名）
  await db.insert(members).values([
    { id: 'm-demo', userId: 'demo-member', name: 'デモ会員', email: 'member@demo.example.com', level: 'intermediate', status: 'active', joinedAt: new Date() },
    { id: 'm-1', name: '山田 太郎', email: 'yamada@demo.example.com', level: 'beginner', status: 'active', joinedAt: new Date() },
    { id: 'm-2', name: '佐藤 花子', email: 'sato@demo.example.com', level: 'intermediate', status: 'active', joinedAt: new Date() },
    { id: 'm-3', name: '鈴木 一郎', email: 'suzuki@demo.example.com', level: 'advanced', status: 'inactive', joinedAt: new Date() }, // 承認待ちの例
  ]);

  // 5. レッスン（定期）
  await db.insert(lessons).values([
    { id: 'lesson-mon', title: '初級クラス（月）', type: 'lesson', startTime: '10:00', endTime: '11:30', recurringDayOfWeek: 1, isRecurring: true, courtId: 'court-1', groupId: 'group-beginner', maxParticipants: 6 },
    { id: 'lesson-wed', title: '中級クラス（水）', type: 'lesson', startTime: '19:00', endTime: '20:30', recurringDayOfWeek: 3, isRecurring: true, courtId: 'court-2', groupId: 'group-intermediate', maxParticipants: 6 },
  ]);

  // 6. レッスン枠（今後2週間・予約可能な未来日）
  const slots = [
    { id: 'slot-1', lessonId: 'lesson-mon', date: futureDate(2), startTime: '10:00', endTime: '11:30' },
    { id: 'slot-2', lessonId: 'lesson-mon', date: futureDate(9), startTime: '10:00', endTime: '11:30' },
    { id: 'slot-3', lessonId: 'lesson-wed', date: futureDate(4), startTime: '19:00', endTime: '20:30' },
    { id: 'slot-4', lessonId: 'lesson-wed', date: futureDate(11), startTime: '19:00', endTime: '20:30' },
  ];
  await db.insert(lessonSlots).values(slots.map((s) => ({ ...s, status: 'open' as const })));

  // 7. サンプル予約（デモ会員が1枠予約済み）と振替クレジット
  await db.insert(reservations).values([
    { id: 'r-1', lessonSlotId: 'slot-1', memberId: 'm-demo', status: 'confirmed', isSubstitution: false },
    { id: 'r-2', lessonSlotId: 'slot-1', memberId: 'm-1', status: 'confirmed', isSubstitution: false },
  ]);
  await db.insert(substitutionCredits).values({
    id: 'cr-1', memberId: 'm-demo', expiresAt: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000),
  });

  console.log('✓ Demo seed complete (admin/staff/member @demo.example.com / demo1234)');
  client.close();
}

main().catch((e) => {
  console.error('Demo seed failed:', e);
  process.exit(1);
});
