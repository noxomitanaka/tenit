/**
 * GET /api/portal/credits — ログイン中会員の振替クレジット一覧
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { substitutionCredits, lessonSlots, lessons } from '@/db/schema';
import { eq, and, isNull, gte, desc } from 'drizzle-orm';
import { requireMember } from '@/lib/api-auth';

export async function GET(_req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;

  const now = new Date();

  const credits = await db
    .select({
      id: substitutionCredits.id,
      expiresAt: substitutionCredits.expiresAt,
      usedAt: substitutionCredits.usedAt,
      createdAt: substitutionCredits.createdAt,
    })
    .from(substitutionCredits)
    .where(eq(substitutionCredits.memberId, auth.member.id))
    .orderBy(desc(substitutionCredits.createdAt));

  // 有効なクレジット: 未使用 + 期限内
  const result = credits.map(c => ({
    ...c,
    isActive: !c.usedAt && new Date(c.expiresAt) >= now,
    isExpired: !c.usedAt && new Date(c.expiresAt) < now,
    isUsed: !!c.usedAt,
  }));

  return NextResponse.json(result);
}
