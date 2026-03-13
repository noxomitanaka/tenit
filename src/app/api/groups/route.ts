import { NextResponse } from 'next/server';
import { db } from '@/db';
import { groups } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { requireAdmin } from '@/lib/api-auth';

export async function GET(_req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const result = await db.select().from(groups).orderBy(asc(groups.sortOrder));
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const [group] = await db.insert(groups).values({
    id: generateId(),
    name: body.name.trim(),
    description: body.description?.trim() ?? null,
    level: body.level ?? null,
    sortOrder: body.sortOrder ?? 0,
  }).returning();

  return NextResponse.json(group, { status: 201 });
}
