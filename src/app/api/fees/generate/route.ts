/**
 * POST /api/fees/generate — アクティブ会員全員分の月謝レコードを一括生成
 * Body: { month: "YYYY-MM" }
 * 既存レコードはスキップ（冪等）
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { monthlyFees, members, clubSettings } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { requireAdmin } from '@/lib/api-auth';

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  if (!body.month || !/^\d{4}-\d{2}$/.test(body.month)) {
    return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 });
  }
  const month: string = body.month;

  // デフォルト月謝をクラブ設定から取得
  const [settings] = await db.select().from(clubSettings);
  const defaultFee = settings?.defaultMonthlyFee ?? 0;

  // アクティブ会員一覧
  const activeMembers = await db
    .select({ id: members.id, monthlyFee: members.monthlyFee })
    .from(members)
    .where(eq(members.status, 'active'));

  if (activeMembers.length === 0) {
    return NextResponse.json({ created: 0, skipped: 0 });
  }

  // 既存レコードを取得してスキップ判定
  const existingFees = await db
    .select({ memberId: monthlyFees.memberId })
    .from(monthlyFees)
    .where(eq(monthlyFees.month, month));

  const existingSet = new Set(existingFees.map((f) => f.memberId));

  const toInsert = activeMembers
    .filter((m) => !existingSet.has(m.id))
    .map((m) => ({
      id: generateId(),
      memberId: m.id,
      month,
      amount: m.monthlyFee ?? defaultFee,
      status: 'pending' as const,
    }));

  if (toInsert.length > 0) {
    await db.insert(monthlyFees).values(toInsert);
  }

  return NextResponse.json({
    created: toInsert.length,
    skipped: activeMembers.length - toInsert.length,
  }, { status: 201 });
}
