import { NextResponse } from 'next/server';
import { db } from '@/db';
import { lessons } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { requireAdmin } from '@/lib/api-auth';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const courtId = searchParams.get('courtId');
  const groupId = searchParams.get('groupId');

  const isRecurring = searchParams.get('isRecurring');

  const conds = [];
  if (courtId) conds.push(eq(lessons.courtId, courtId));
  if (groupId) conds.push(eq(lessons.groupId, groupId));
  if (isRecurring === 'true') conds.push(eq(lessons.isRecurring, true));
  else if (isRecurring === 'false') conds.push(eq(lessons.isRecurring, false));

  const result = await db.select().from(lessons)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(desc(lessons.createdAt));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  if (!body.startTime || !body.endTime) {
    return NextResponse.json({ error: 'startTime and endTime are required' }, { status: 400 });
  }

  const [lesson] = await db.insert(lessons).values({
    id: generateId(),
    title: body.title.trim(),
    coachId: body.coachId ?? null,
    courtId: body.courtId ?? null,
    groupId: body.groupId ?? null,
    type: body.type ?? 'lesson',
    isRecurring: body.isRecurring ?? false,
    recurringDayOfWeek: body.recurringDayOfWeek ?? null,
    startTime: body.startTime,
    endTime: body.endTime,
    maxParticipants: body.maxParticipants ?? null,
    notes: body.notes?.trim() ?? null,
  }).returning();

  return NextResponse.json(lesson, { status: 201 });
}
