/**
 * GET  /api/fees/[id] — 月謝詳細
 * PATCH /api/fees/[id] — ステータス更新（paid/overdue/waived/pending）
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { monthlyFees, members } from '@/db/schema';
import { eq, sql as drizzleSql } from 'drizzle-orm';
import { requireAdmin } from '@/lib/api-auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const [row] = await db
    .select({
      id: monthlyFees.id,
      memberId: monthlyFees.memberId,
      memberName: members.name,
      month: monthlyFees.month,
      amount: monthlyFees.amount,
      status: monthlyFees.status,
      paidAt: monthlyFees.paidAt,
      notes: monthlyFees.notes,
      stripePaymentIntentId: monthlyFees.stripePaymentIntentId,
      stripeCheckoutSessionId: monthlyFees.stripeCheckoutSessionId,
      createdAt: monthlyFees.createdAt,
    })
    .from(monthlyFees)
    .innerJoin(members, eq(monthlyFees.memberId, members.id))
    .where(eq(monthlyFees.id, id));

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json();

  const validStatuses = ['pending', 'paid', 'overdue', 'waived'] as const;
  if (body.status && !validStatuses.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const [existing] = await db.select().from(monthlyFees).where(eq(monthlyFees.id, id));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updateData: Partial<typeof monthlyFees.$inferInsert> = {};
  let clearPaidAt = false;

  if (body.status !== undefined) {
    updateData.status = body.status;
    if (body.status === 'paid' && !existing.paidAt) {
      updateData.paidAt = new Date();
    } else if (body.status !== 'paid') {
      // Drizzle の timestamp_ms カラムは null を直接 .set() に渡せない（getTime() バグ）
      // → 別途 raw SQL で NULL に更新する
      clearPaidAt = true;
    }
  }
  if (body.amount !== undefined) updateData.amount = Number(body.amount);
  if (body.notes !== undefined) updateData.notes = body.notes?.trim() ?? null;

  await db.update(monthlyFees).set(updateData).where(eq(monthlyFees.id, id));

  if (clearPaidAt) {
    // Drizzle の timestamp_ms カラムは null を経由すると getTime() バグが出るため
    // libsql $client を直接呼び出してバイパス
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).$client.execute({
      sql: 'UPDATE monthly_fee SET paid_at = NULL WHERE id = ?',
      args: [id],
    });
  }

  const [updated] = await db.select().from(monthlyFees).where(eq(monthlyFees.id, id));
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const [existing] = await db.select().from(monthlyFees).where(eq(monthlyFees.id, id));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(monthlyFees).where(eq(monthlyFees.id, id));
  return NextResponse.json({ ok: true });
}
