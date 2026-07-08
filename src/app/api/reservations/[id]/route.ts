import { NextResponse } from 'next/server';
import { db, asRows } from '@/db';
import { reservations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/api-auth';
import { issueCancellationCredit } from '@/lib/reservations';

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

  // ステータス更新とクレジット発行を単一トランザクションに包み、
  // confirmed→cancelled→confirmed の往復による TOCTOU とクレジット無限増殖を防ぐ。
  // クレジット発行は通常予約の confirmed からのキャンセル/欠席時のみ。
  // 期限チェック・冪等ガードは issueCancellationCredit に集約。
  const shouldIssueCredit =
    (body.status === 'cancelled' || body.status === 'absent') &&
    existing.status === 'confirmed' &&
    !existing.isSubstitution;

  const result = await db.transaction(async (tx) => {
    const [row] = asRows(await tx.update(reservations).set({
      status: body.status,
      notes: body.notes ?? existing.notes,
    }).where(eq(reservations.id, id)).returning());

    const issued = shouldIssueCredit ? await issueCancellationCredit(tx, existing) : null;
    return { updated: row, credit: issued };
  });

  return NextResponse.json({ reservation: result.updated, credit: result.credit });
}
