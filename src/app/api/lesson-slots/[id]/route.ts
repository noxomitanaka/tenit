import { NextResponse } from 'next/server';
import { db, asRows } from '@/db';
import { lessonSlots, reservations, substitutionCredits, clubSettings } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { requireAdmin } from '@/lib/api-auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const [slot] = await db.select().from(lessonSlots).where(eq(lessonSlots.id, id));
  if (!slot) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(slot);
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json();

  const [existing] = await db.select().from(lessonSlots).where(eq(lessonSlots.id, id));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const validStatuses = ['open', 'cancelled', 'completed'];
  if (body.status && !validStatuses.includes(body.status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 });
  }

  // 休講（open→cancelled）はクラブ都合のため、そのスロットの confirmed 予約を
  // 一括キャンセルし、通常予約には振替クレジットを発行（期限判定なし）、
  // 振替予約には消費済みクレジットを返却する。放置すると予約が confirmed のまま
  // 残り会員が枠を失うだけになる。
  const isClubCancellation = body.status === 'cancelled' && existing.status !== 'cancelled';

  const result = await db.transaction(async (tx) => {
    const [row] = asRows(await tx.update(lessonSlots).set({
      status: body.status ?? existing.status,
      cancelReason: body.cancelReason ?? existing.cancelReason,
    }).where(eq(lessonSlots.id, id)).returning());

    let cancelledCount = 0;
    let creditsIssued = 0;
    if (isClubCancellation) {
      const [settings] = await tx.select().from(clubSettings).limit(1);
      const deadlineDays = settings?.substitutionDeadlineDays ?? 31;
      const affected = await tx.select().from(reservations).where(
        and(eq(reservations.lessonSlotId, id), eq(reservations.status, 'confirmed'))
      );
      for (const r of affected) {
        await tx.update(reservations).set({ status: 'cancelled' }).where(eq(reservations.id, r.id));
        cancelledCount++;
        if (r.isSubstitution) {
          // 振替予約: 消費した振替クレジットを未使用に戻す
          await tx.update(substitutionCredits)
            .set({ usedAt: null, usedReservationId: null })
            .where(eq(substitutionCredits.usedReservationId, r.id));
        } else {
          // 通常予約: 振替クレジットを新規発行（同一予約発の重複は避ける）
          const [dup] = await tx.select({ id: substitutionCredits.id }).from(substitutionCredits)
            .where(eq(substitutionCredits.sourceReservationId, r.id));
          if (!dup) {
            await tx.insert(substitutionCredits).values({
              id: generateId(),
              memberId: r.memberId,
              sourceReservationId: r.id,
              expiresAt: new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000),
            });
            creditsIssued++;
          }
        }
      }
    }

    return { row, cancelledCount, creditsIssued };
  });

  return NextResponse.json({
    ...result.row,
    ...(isClubCancellation
      ? { cancelledReservations: result.cancelledCount, creditsIssued: result.creditsIssued }
      : {}),
  });
}
