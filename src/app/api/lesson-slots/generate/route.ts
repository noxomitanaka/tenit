/**
 * POST /api/lesson-slots/generate
 * 定期レッスンから指定期間のスロットを一括生成
 * body: { from: "YYYY-MM-DD", to: "YYYY-MM-DD", lessonId?: string }
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { lessons, lessonSlots } from '@/db/schema';
import { eq, and, between, inArray } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { requireAdmin } from '@/lib/api-auth';

function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cur = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const { from, to, lessonId } = body;

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to are required (YYYY-MM-DD)' }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ error: 'from must be before to' }, { status: 400 });
  }
  // 最大90日制限
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const diffDays = (toDate.getTime() - fromDate.getTime()) / 86400000;
  if (diffDays > 90) {
    return NextResponse.json({ error: 'Range cannot exceed 90 days' }, { status: 400 });
  }

  // 対象レッスンを取得（定期レッスンのみ）
  let recurringLessons;
  if (lessonId) {
    const [l] = await db.select().from(lessons).where(
      and(eq(lessons.id, lessonId), eq(lessons.isRecurring, true))
    );
    if (!l) return NextResponse.json({ error: 'Recurring lesson not found' }, { status: 404 });
    recurringLessons = [l];
  } else {
    recurringLessons = await db.select().from(lessons).where(eq(lessons.isRecurring, true));
  }

  if (recurringLessons.length === 0) {
    return NextResponse.json({ error: 'No recurring lessons found' }, { status: 404 });
  }

  // 既存スロットを取得（重複防止）
  const lessonIds = recurringLessons.map(l => l.id);
  const existingSlots = await db.select({ lessonId: lessonSlots.lessonId, date: lessonSlots.date })
    .from(lessonSlots)
    .where(
      and(
        inArray(lessonSlots.lessonId, lessonIds),
        between(lessonSlots.date, from, to)
      )
    );
  const existingSet = new Set(existingSlots.map(s => `${s.lessonId}:${s.date}`));

  // 生成
  const allDates = dateRange(from, to);
  const toInsert: typeof lessonSlots.$inferInsert[] = [];

  for (const lesson of recurringLessons) {
    const dow = lesson.recurringDayOfWeek ?? -1;
    if (dow < 0) continue; // dayOfWeek未設定はスキップ

    for (const date of allDates) {
      const d = new Date(date + 'T00:00:00');
      if (d.getDay() !== dow) continue; // 曜日一致チェック
      const key = `${lesson.id}:${date}`;
      if (existingSet.has(key)) continue; // 重複スキップ

      toInsert.push({
        id: generateId(),
        lessonId: lesson.id,
        date,
        startTime: lesson.startTime,
        endTime: lesson.endTime,
        status: 'open',
      });
    }
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ created: 0, message: 'All slots already exist' });
  }

  // 100件ずつバッチ挿入
  const BATCH = 100;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    await db.insert(lessonSlots).values(toInsert.slice(i, i + BATCH));
  }

  return NextResponse.json({ created: toInsert.length }, { status: 201 });
}
