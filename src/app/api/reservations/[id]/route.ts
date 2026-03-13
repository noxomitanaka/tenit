import { NextResponse } from 'next/server';
import { db } from '@/db';
import { reservations, substitutionCredits, clubSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { requireAdmin } from '@/lib/api-auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const [rsv] = await db.select().from(reservations).where(eq(reservations.id, id));
  if (!rsv) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(rsv);
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json();

  const [existing] = await db.select().from(reservations).where(eq(reservations.id, id));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const validStatuses = ['confirmed', 'cancelled', 'absent'];
  if (!validStatuses.includes(body.status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 });
  }

  const [updated] = await db.update(reservations).set({
    status: body.status,
    notes: body.notes ?? existing.notes,
  }).where(eq(reservations.id, id)).returning();

  // 通常予約のキャンセル/欠席時に振替クレジットを発行
  let credit = null;
  if (
    (body.status === 'cancelled' || body.status === 'absent') &&
    existing.status === 'confirmed' &&
    !existing.isSubstitution
  ) {
    const [settings] = await db.select().from(clubSettings).limit(1);
    const deadlineDays = settings?.substitutionDeadlineDays ?? 31;
    const expiresAt = new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000);

    [credit] = await db.insert(substitutionCredits).values({
      id: generateId(),
      memberId: existing.memberId,
      sourceReservationId: existing.id,
      expiresAt,
    }).returning();
  }

  return NextResponse.json({ reservation: updated, credit });
}
