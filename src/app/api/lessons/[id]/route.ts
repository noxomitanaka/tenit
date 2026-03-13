import { NextResponse } from 'next/server';
import { db } from '@/db';
import { lessons } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/api-auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, id));
  if (!lesson) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(lesson);
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json();

  const [existing] = await db.select().from(lessons).where(eq(lessons.id, id));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [updated] = await db.update(lessons).set({
    title: body.title?.trim() ?? existing.title,
    coachId: body.coachId ?? existing.coachId,
    courtId: body.courtId ?? existing.courtId,
    groupId: body.groupId ?? existing.groupId,
    type: body.type ?? existing.type,
    isRecurring: body.isRecurring ?? existing.isRecurring,
    recurringDayOfWeek: body.recurringDayOfWeek ?? existing.recurringDayOfWeek,
    startTime: body.startTime ?? existing.startTime,
    endTime: body.endTime ?? existing.endTime,
    maxParticipants: body.maxParticipants ?? existing.maxParticipants,
    notes: body.notes?.trim() ?? existing.notes,
  }).where(eq(lessons.id, id)).returning();

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const [existing] = await db.select().from(lessons).where(eq(lessons.id, id));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(lessons).where(eq(lessons.id, id));
  return NextResponse.json({ deleted: true });
}
