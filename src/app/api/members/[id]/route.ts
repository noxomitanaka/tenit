import { NextResponse } from 'next/server';
import { db } from '@/db';
import { members } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/api-auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const [member] = await db.select().from(members).where(eq(members.id, id));
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(member);
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json();

  const [existing] = await db.select().from(members).where(eq(members.id, id));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (body.name !== undefined && !body.name?.trim()) {
    return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
  }

  const [updated] = await db.update(members).set({
    name: body.name?.trim() ?? existing.name,
    nameKana: body.nameKana?.trim() ?? existing.nameKana,
    email: body.email?.trim() ?? existing.email,
    phone: body.phone?.trim() ?? existing.phone,
    level: body.level ?? existing.level,
    status: body.status ?? existing.status,
    notes: body.notes?.trim() ?? existing.notes,
    leftAt: body.status === 'inactive' && !existing.leftAt ? new Date() : existing.leftAt,
  }).where(eq(members.id, id)).returning();

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const [existing] = await db.select().from(members).where(eq(members.id, id));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // ソフトデリート: status=inactive
  const [updated] = await db.update(members)
    .set({ status: 'inactive', leftAt: new Date() })
    .where(eq(members.id, id))
    .returning();

  return NextResponse.json(updated);
}
