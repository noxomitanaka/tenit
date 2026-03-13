/**
 * GET  /api/portal/profile — ログイン中会員のプロフィール取得
 * PATCH /api/portal/profile — プロフィール更新（name, email, phone）
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { members } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireMember } from '@/lib/api-auth';

export async function GET(_req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;

  const { id, name, nameKana, email, phone, level, status, lineUserId, notes } = auth.member;
  return NextResponse.json({ id, name, nameKana, email, phone, level, status, lineUserId, notes });
}

export async function PATCH(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;

  const body = await req.json();

  if (body.name !== undefined && !body.name?.trim()) {
    return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
  }

  const updateData: Partial<typeof members.$inferInsert> = {};
  if (body.name !== undefined) updateData.name = body.name.trim();
  if (body.nameKana !== undefined) updateData.nameKana = body.nameKana?.trim() || null;
  if (body.email !== undefined) updateData.email = body.email?.trim() || null;
  if (body.phone !== undefined) updateData.phone = body.phone?.trim() || null;

  const [updated] = await db
    .update(members)
    .set(updateData)
    .where(eq(members.id, auth.member.id))
    .returning();

  const { id, name, nameKana, email, phone, level, status, lineUserId, notes } = updated;
  return NextResponse.json({ id, name, nameKana, email, phone, level, status, lineUserId, notes });
}
