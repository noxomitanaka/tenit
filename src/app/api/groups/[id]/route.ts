import { NextResponse } from 'next/server';
import { db } from '@/db';
import { groups } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/api-auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const [group] = await db.select().from(groups).where(eq(groups.id, id));
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(group);
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json();

  const [existing] = await db.select().from(groups).where(eq(groups.id, id));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [updated] = await db.update(groups).set({
    name: body.name?.trim() ?? existing.name,
    description: body.description?.trim() ?? existing.description,
    level: body.level ?? existing.level,
    sortOrder: body.sortOrder ?? existing.sortOrder,
  }).where(eq(groups.id, id)).returning();

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const [existing] = await db.select().from(groups).where(eq(groups.id, id));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(groups).where(eq(groups.id, id));
  return NextResponse.json({ deleted: true });
}
