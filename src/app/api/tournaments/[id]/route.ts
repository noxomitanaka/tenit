import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tournaments, tournamentEntries, tournamentMatches, members } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/api-auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id));
  if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const entries = await db
    .select({ entry: tournamentEntries, memberName: members.name })
    .from(tournamentEntries)
    .innerJoin(members, eq(tournamentEntries.memberId, members.id))
    .where(eq(tournamentEntries.tournamentId, id))
    .orderBy(tournamentEntries.seed);

  const matches = await db.select().from(tournamentMatches)
    .where(eq(tournamentMatches.tournamentId, id))
    .orderBy(tournamentMatches.round, tournamentMatches.createdAt);

  return NextResponse.json({ tournament, entries, matches });
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json();

  const [existing] = await db.select().from(tournaments).where(eq(tournaments.id, id));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [updated] = await db.update(tournaments).set({
    name: body.name?.trim() ?? existing.name,
    status: body.status ?? existing.status,
    date: body.date ?? existing.date,
    rounds: body.rounds != null ? Number(body.rounds) : existing.rounds,
    notes: body.notes != null ? body.notes.trim() : existing.notes,
  }).where(eq(tournaments.id, id)).returning();

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  await db.delete(tournaments).where(eq(tournaments.id, id));
  return NextResponse.json({ ok: true });
}
