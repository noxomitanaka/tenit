import { NextResponse } from 'next/server';
import { db } from '@/db';
import { members, reservations, lessonSlots, substitutionCredits } from '@/db/schema';
import { eq, and, isNull, gte, sql } from 'drizzle-orm';
import { requireAdmin } from '@/lib/api-auth';

export async function GET(_req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  // アクティブ会員数
  const [memberRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(members)
    .where(eq(members.status, 'active'));

  // 今日のスロットに対する確定予約数（JOIN）
  const [todayRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(reservations)
    .innerJoin(lessonSlots, eq(reservations.lessonSlotId, lessonSlots.id))
    .where(
      and(
        eq(reservations.status, 'confirmed'),
        eq(lessonSlots.date, today)
      )
    );

  // 未使用かつ有効期限内の振替クレジット数
  const [creditRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(substitutionCredits)
    .where(
      and(
        isNull(substitutionCredits.usedAt),
        gte(substitutionCredits.expiresAt, now)
      )
    );

  return NextResponse.json({
    activeMembers: Number(memberRow?.count ?? 0),
    todayReservations: Number(todayRow?.count ?? 0),
    pendingSubstitutions: Number(creditRow?.count ?? 0),
    monthlyUtilization: null, // Phase 2で実装
  });
}
