import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tournaments } from '@/db/schema';
import { desc, sql } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { requireAdmin } from '@/lib/api-auth';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');
  const paginated = limitParam !== null || offsetParam !== null;

  if (!paginated) {
    const list = await db.select().from(tournaments).orderBy(desc(tournaments.createdAt));
    return NextResponse.json(list);
  }

  const limit = Math.min(Math.max(1, Number(limitParam) || 50), 200);
  const offset = Math.max(0, Number(offsetParam) || 0);

  const [list, [{ total }]] = await Promise.all([
    db.select().from(tournaments).orderBy(desc(tournaments.createdAt)).limit(limit).offset(offset),
    db.select({ total: sql<number>`count(*)` }).from(tournaments),
  ]);

  return NextResponse.json({ data: list, total: Number(total), limit, offset });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const [tournament] = await db.insert(tournaments).values({
    id: generateId(),
    name: body.name.trim(),
    type: body.type ?? 'swiss',
    date: body.date ?? null,
    rounds: body.rounds ? Number(body.rounds) : 3,
    maxParticipants: body.maxParticipants ? Number(body.maxParticipants) : null,
    notes: body.notes?.trim() ?? null,
  }).returning();

  return NextResponse.json(tournament, { status: 201 });
}
