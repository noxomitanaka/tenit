import { NextResponse } from 'next/server';
import { db } from '@/db';
import { lessonSlots } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/api-auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const [slot] = await db.select().from(lessonSlots).where(eq(lessonSlots.id, id));
  if (!slot) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(slot);
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json();

  const [existing] = await db.select().from(lessonSlots).where(eq(lessonSlots.id, id));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const validStatuses = ['open', 'cancelled', 'completed'];
  if (body.status && !validStatuses.includes(body.status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 });
  }

  const [updated] = await db.update(lessonSlots).set({
    status: body.status ?? existing.status,
    cancelReason: body.cancelReason ?? existing.cancelReason,
  }).where(eq(lessonSlots.id, id)).returning();

  return NextResponse.json(updated);
}
