/**
 * GET  /api/fees — 月謝一覧（?month=YYYY-MM, ?memberId=, ?status=）
 * POST /api/fees — 月謝レコードを手動作成
 */
import { NextResponse } from 'next/server';
import { db, asRows } from '@/db';
import { monthlyFees, members } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { requireAdmin } from '@/lib/api-auth';
import { isNonNegativeInt, isOneOf } from '@/lib/validation';

const FEE_STATUSES = ['pending', 'paid', 'overdue', 'waived'] as const;

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  const memberId = searchParams.get('memberId');
  const status = searchParams.get('status');
  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');
  const paginated = limitParam !== null || offsetParam !== null;

  const conds = [];
  if (month) conds.push(eq(monthlyFees.month, month));
  if (memberId) conds.push(eq(monthlyFees.memberId, memberId));
  if (status) conds.push(eq(monthlyFees.status, status as 'pending' | 'paid' | 'overdue' | 'waived'));
  const where = conds.length > 0 ? and(...conds) : undefined;

  const selectFields = {
    id: monthlyFees.id,
    memberId: monthlyFees.memberId,
    memberName: members.name,
    month: monthlyFees.month,
    amount: monthlyFees.amount,
    status: monthlyFees.status,
    paidAt: monthlyFees.paidAt,
    notes: monthlyFees.notes,
    createdAt: monthlyFees.createdAt,
  };

  if (!paginated) {
    const rows = await db.select(selectFields).from(monthlyFees)
      .innerJoin(members, eq(monthlyFees.memberId, members.id))
      .where(where)
      .orderBy(desc(monthlyFees.month), members.name);
    return NextResponse.json(rows);
  }

  const limit = Math.min(Math.max(1, Number(limitParam) || 50), 200);
  const offset = Math.max(0, Number(offsetParam) || 0);

  const [rows, [{ total }]] = await Promise.all([
    db.select(selectFields).from(monthlyFees)
      .innerJoin(members, eq(monthlyFees.memberId, members.id))
      .where(where)
      .orderBy(desc(monthlyFees.month), members.name)
      .limit(limit).offset(offset),
    db.select({ total: sql<number>`count(*)` }).from(monthlyFees)
      .innerJoin(members, eq(monthlyFees.memberId, members.id))
      .where(where),
  ]);

  return NextResponse.json({ data: rows, total: Number(total), limit, offset });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  if (!body.memberId || !body.month || body.amount == null) {
    return NextResponse.json({ error: 'memberId, month, amount are required' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}$/.test(body.month)) {
    return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 });
  }
  // amount は NaN・Infinity・負値・巨大値の DB 混入を防ぐため非負整数を必須化する。
  if (!isNonNegativeInt(body.amount)) {
    return NextResponse.json({ error: 'amount must be a non-negative integer' }, { status: 400 });
  }
  if (body.status !== undefined && !isOneOf(body.status, FEE_STATUSES)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 });
  }

  const [fee] = asRows(await db.insert(monthlyFees).values({
    id: generateId(),
    memberId: body.memberId,
    month: body.month,
    amount: Number(body.amount),
    status: body.status ?? 'pending',
    notes: body.notes?.trim() ?? null,
  }).returning());

  return NextResponse.json(fee, { status: 201 });
}
