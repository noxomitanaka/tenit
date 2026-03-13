/**
 * テスト用DB操作ヘルパー
 */
import { testDb } from '../setup';
import { users, clubSettings, members, groups, courts, lessons, lessonSlots, reservations, substitutionCredits, memberGroups, accounts, sessions, verificationTokens, tournaments, tournamentEntries, tournamentMatches } from '@/db/schema';

/** 全テーブルをリセット（各テストの beforeEach で使用） */
export async function resetDb() {
  // 外部キー制約の順番を考慮して削除
  await testDb.delete(tournamentMatches);
  await testDb.delete(tournamentEntries);
  await testDb.delete(tournaments);
  await testDb.delete(substitutionCredits);
  await testDb.delete(reservations);
  await testDb.delete(lessonSlots);
  await testDb.delete(lessons);
  await testDb.delete(memberGroups);
  await testDb.delete(members);
  await testDb.delete(groups);
  await testDb.delete(courts);
  await testDb.delete(clubSettings);
  await testDb.delete(sessions);
  await testDb.delete(accounts);
  await testDb.delete(verificationTokens);
  await testDb.delete(users);
}
