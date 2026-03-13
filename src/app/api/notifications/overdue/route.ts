/**
 * POST /api/notifications/overdue — 期限切れ月謝を overdue に自動更新
 * 翌月以降の請求日を基準に、未払い（pending）のまま放置されたものを overdue に変更
 * Body: { beforeMonth?: "YYYY-MM" }  省略時は今月より前
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { monthlyFees } from '@/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { requireAdmin } from '@/lib/api-auth';

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const beforeMonth = (body.beforeMonth as string | undefined) ?? thisMonth;

  if (!/^\d{4}-\d{2}$/.test(beforeMonth)) {
    return NextResponse.json({ error: 'beforeMonth must be YYYY-MM' }, { status: 400 });
  }

  // pending かつ beforeMonth より前の月謝を overdue に更新
  const result = await db
    .update(monthlyFees)
    .set({ status: 'overdue' })
    .where(and(eq(monthlyFees.status, 'pending'), lt(monthlyFees.month, beforeMonth)))
    .returning({ id: monthlyFees.id, memberId: monthlyFees.memberId, month: monthlyFees.month });

  return NextResponse.json({
    updated: result.length,
    months: [...new Set(result.map(r => r.month))].sort(),
  });
}
