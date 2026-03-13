import { NextResponse } from 'next/server';
import { db } from '@/db';
import { courts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/api-auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const [court] = await db.select().from(courts).where(eq(courts.id, id));
  if (!court) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(court);
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json();

  const [existing] = await db.select().from(courts).where(eq(courts.id, id));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [updated] = await db.update(courts).set({
    name: body.name?.trim() ?? existing.name,
    surface: body.surface ?? existing.surface,
    isIndoor: body.isIndoor ?? existing.isIndoor,
    isActive: body.isActive ?? existing.isActive,
    sortOrder: body.sortOrder ?? existing.sortOrder,
  }).where(eq(courts.id, id)).returning();

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const [existing] = await db.select().from(courts).where(eq(courts.id, id));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // ソフトデリート: isActive=false
  const [updated] = await db.update(courts)
    .set({ isActive: false })
    .where(eq(courts.id, id))
    .returning();

  return NextResponse.json(updated);
}
