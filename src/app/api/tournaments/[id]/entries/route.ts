import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tournaments, tournamentEntries, members } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { requireAdmin } from '@/lib/api-auth';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: tournamentId } = await params;
  const body = await req.json();

  if (!body.memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 });

  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  if (tournament.status !== 'draft') {
    return NextResponse.json({ error: 'Cannot add entries after tournament starts' }, { status: 409 });
  }

  const [member] = await db.select().from(members).where(eq(members.id, body.memberId));
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  // 重複チェック
  const [dup] = await db.select().from(tournamentEntries)
    .where(and(eq(tournamentEntries.tournamentId, tournamentId), eq(tournamentEntries.memberId, body.memberId)));
  if (dup) return NextResponse.json({ error: 'Already registered' }, { status: 409 });

  const [entry] = await db.insert(tournamentEntries).values({
    id: generateId(),
    tournamentId,
    memberId: body.memberId,
    seed: body.seed ?? null,
  }).returning();

  return NextResponse.json(entry, { status: 201 });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: tournamentId } = await params;
  const { searchParams } = new URL(req.url);
  const entryId = searchParams.get('entryId');
  if (!entryId) return NextResponse.json({ error: 'entryId required' }, { status: 400 });

  await db.delete(tournamentEntries)
    .where(and(eq(tournamentEntries.id, entryId), eq(tournamentEntries.tournamentId, tournamentId)));
  return NextResponse.json({ ok: true });
}
