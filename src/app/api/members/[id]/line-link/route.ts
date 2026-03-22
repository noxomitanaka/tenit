/**
 * POST /api/members/[id]/line-link — LINE連携用6桁PINを発行（有効期限5分）
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { members, lineLinkPins } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { requireAdmin } from '@/lib/api-auth';
import { randomInt } from 'crypto';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const [member] = await db.select().from(members).where(eq(members.id, id));
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const pin = String(randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分後

  const [created] = await db.insert(lineLinkPins).values({
    id: generateId(),
    memberId: id,
    pin,
    expiresAt,
  }).returning();

  return NextResponse.json({
    pin: created.pin,
    expiresAt: created.expiresAt,
    instruction: `LINEで「リンク ${created.pin}」と送信してください（5分以内）`,
  }, { status: 201 });
}
