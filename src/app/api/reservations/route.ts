import { NextResponse } from 'next/server';
import { db } from '@/db';
import { reservations, lessonSlots } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { requireAdmin } from '@/lib/api-auth';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const slotId = searchParams.get('slotId');
  const memberId = searchParams.get('memberId');
  const status = searchParams.get('status') as 'confirmed' | 'cancelled' | 'absent' | null;

  const conds = [];
  if (slotId) conds.push(eq(reservations.lessonSlotId, slotId));
  if (memberId) conds.push(eq(reservations.memberId, memberId));
  if (status) conds.push(eq(reservations.status, status));

  const result = await db.select().from(reservations)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(reservations.createdAt);

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  if (!body.lessonSlotId || !body.memberId) {
    return NextResponse.json(
      { error: 'lessonSlotId and memberId are required' },
      { status: 400 }
    );
  }

  // スロットの存在・状態確認
  const [slot] = await db.select().from(lessonSlots).where(eq(lessonSlots.id, body.lessonSlotId));
  if (!slot) return NextResponse.json({ error: 'lesson slot not found' }, { status: 404 });
  if (slot.status !== 'open') {
    return NextResponse.json({ error: 'lesson slot is not available' }, { status: 409 });
  }

  // 重複予約チェック
  const [existing] = await db.select().from(reservations).where(
    and(
      eq(reservations.lessonSlotId, body.lessonSlotId),
      eq(reservations.memberId, body.memberId),
      eq(reservations.status, 'confirmed')
    )
  );
  if (existing) return NextResponse.json({ error: 'reservation already exists' }, { status: 409 });

  const [reservation] = await db.insert(reservations).values({
    id: generateId(),
    lessonSlotId: body.lessonSlotId,
    memberId: body.memberId,
    status: 'confirmed',
    isSubstitution: body.isSubstitution ?? false,
    originalReservationId: body.originalReservationId ?? null,
    notes: body.notes?.trim() ?? null,
  }).returning();

  return NextResponse.json(reservation, { status: 201 });
}
