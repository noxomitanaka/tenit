import { NextResponse } from 'next/server';
import { db } from '@/db';
import { substitutionCredits } from '@/db/schema';
import { eq, and, isNull, gte } from 'drizzle-orm';
import { requireAdmin } from '@/lib/api-auth';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get('memberId');
  const unusedOnly = searchParams.get('unused') === 'true';
  const activeOnly = searchParams.get('active') === 'true';

  const conds = [];
  if (memberId) conds.push(eq(substitutionCredits.memberId, memberId));
  if (unusedOnly) conds.push(isNull(substitutionCredits.usedAt));
  if (activeOnly) conds.push(gte(substitutionCredits.expiresAt, new Date()));

  const result = await db.select().from(substitutionCredits)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(substitutionCredits.expiresAt);

  return NextResponse.json(result);
}
