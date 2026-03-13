import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tournaments } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { requireAdmin } from '@/lib/api-auth';

export async function GET(_req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const list = await db.select().from(tournaments).orderBy(desc(tournaments.createdAt));
  return NextResponse.json(list);
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
