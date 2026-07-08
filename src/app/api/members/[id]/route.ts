import { NextResponse } from 'next/server';
import { db, asRows } from '@/db';
import { members } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/api-auth';
import { isValidEmail, isOneOf, MEMBER_LEVELS, MEMBER_STATUSES } from '@/lib/validation';

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
  if (body.email != null && body.email !== '' && !isValidEmail(body.email.trim?.())) {
    return NextResponse.json({ error: 'invalid email format' }, { status: 400 });
  }
  if (body.level != null && !isOneOf(body.level, MEMBER_LEVELS)) {
    return NextResponse.json({ error: 'invalid level' }, { status: 400 });
  }
  if (body.status != null && !isOneOf(body.status, MEMBER_STATUSES)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 });
  }

  const [updated] = asRows(await db.update(members).set({
    name: body.name?.trim() ?? existing.name,
    nameKana: body.nameKana?.trim() ?? existing.nameKana,
    email: body.email?.trim() ?? existing.email,
    phone: body.phone?.trim() ?? existing.phone,
    level: body.level ?? existing.level,
    status: body.status ?? existing.status,
    lineUserId: 'lineUserId' in body ? (body.lineUserId || null) : existing.lineUserId,
    notes: body.notes?.trim() ?? existing.notes,
    leftAt: body.status === 'inactive' && !existing.leftAt ? new Date() : existing.leftAt,
  }).where(eq(members.id, id)).returning());

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const [existing] = await db.select().from(members).where(eq(members.id, id));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // ソフトデリート: status=inactive
  const [updated] = asRows(await db.update(members)
    .set({ status: 'inactive', leftAt: new Date() })
    .where(eq(members.id, id))
    .returning());

  return NextResponse.json(updated);
}
