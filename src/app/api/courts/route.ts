import { NextResponse } from 'next/server';
import { db } from '@/db';
import { courts } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { requireAdmin } from '@/lib/api-auth';

export async function GET(_req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const result = await db.select().from(courts).orderBy(asc(courts.sortOrder));
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const [court] = await db.insert(courts).values({
    id: generateId(),
    name: body.name.trim(),
    surface: body.surface ?? null,
    isIndoor: body.isIndoor ?? false,
    isActive: true,
    sortOrder: body.sortOrder ?? 0,
  }).returning();

  return NextResponse.json(court, { status: 201 });
}
