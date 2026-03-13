import { NextResponse } from 'next/server';
import { db } from '@/db';
import { lessonSlots, lessons } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { generateRecurringSlots } from '@/lib/slots';
import { requireAdmin } from '@/lib/api-auth';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const lessonId = searchParams.get('lessonId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const status = searchParams.get('status') as 'open' | 'cancelled' | 'completed' | null;

  const conds = [];
  if (lessonId) conds.push(eq(lessonSlots.lessonId, lessonId));
  if (from) conds.push(gte(lessonSlots.date, from));
  if (to) conds.push(lte(lessonSlots.date, to));
  if (status) conds.push(eq(lessonSlots.status, status));

  const result = await db.select().from(lessonSlots)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(lessonSlots.date, lessonSlots.startTime);

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json();

  // バッチ生成モード: { lessonId, from, to } で繰り返しスロットを一括生成
  if (body.lessonId && body.from && body.to && !body.date) {
    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, body.lessonId));
    if (!lesson) return NextResponse.json({ error: 'lesson not found' }, { status: 404 });
    if (!lesson.isRecurring || lesson.recurringDayOfWeek == null) {
      return NextResponse.json({ error: 'lesson is not recurring' }, { status: 400 });
    }

    const toInsert = generateRecurringSlots(lesson as Parameters<typeof generateRecurringSlots>[0], body.from, body.to);
    if (toInsert.length === 0) return NextResponse.json([], { status: 201 });

    const inserted = await db.insert(lessonSlots).values(toInsert).returning();
    return NextResponse.json(inserted, { status: 201 });
  }

  // 単体作成モード
  if (!body.lessonId || !body.date || !body.startTime || !body.endTime) {
    return NextResponse.json(
      { error: 'lessonId, date, startTime, endTime are required' },
      { status: 400 }
    );
  }

  const [slot] = await db.insert(lessonSlots).values({
    id: generateId(),
    lessonId: body.lessonId,
    date: body.date,
    startTime: body.startTime,
    endTime: body.endTime,
    status: 'open',
  }).returning();

  return NextResponse.json(slot, { status: 201 });
}
