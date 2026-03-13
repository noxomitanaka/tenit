/**
 * GET /api/portal/fees — ログイン中会員の月謝一覧
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { monthlyFees } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireMember } from '@/lib/api-auth';

export async function GET(_req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;

  const rows = await db
    .select({
      id: monthlyFees.id,
      month: monthlyFees.month,
      amount: monthlyFees.amount,
      status: monthlyFees.status,
      paidAt: monthlyFees.paidAt,
    })
    .from(monthlyFees)
    .where(eq(monthlyFees.memberId, auth.member.id))
    .orderBy(desc(monthlyFees.month));

  return NextResponse.json(rows);
}
