/**
 * GET  /api/members/[id]/family — 家族メンバー一覧（parentMemberId = id）
 * POST /api/members/[id]/family — 家族メンバーを紐付け（既存会員のparentMemberIdを設定）
 * DELETE /api/members/[id]/family?childId= — 紐付け解除
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { members } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAdmin } from '@/lib/api-auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  // 親として登録されている会員が存在するか確認
  const [parent] = await db.select().from(members).where(eq(members.id, id));
  if (!parent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // この会員を親に持つ子会員一覧
  const children = await db
    .select()
    .from(members)
    .where(eq(members.parentMemberId, id));

  return NextResponse.json({ parent, children });
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: parentId } = await params;
  const body = await req.json();

  if (!body.childId) {
    return NextResponse.json({ error: 'childId is required' }, { status: 400 });
  }

  // 親会員の存在確認
  const [parent] = await db.select().from(members).where(eq(members.id, parentId));
  if (!parent) return NextResponse.json({ error: 'Parent member not found' }, { status: 404 });

  // 自己参照チェック
  if (body.childId === parentId) {
    return NextResponse.json({ error: 'Cannot link member to themselves' }, { status: 400 });
  }

  // 子会員の存在確認
  const [child] = await db.select().from(members).where(eq(members.id, body.childId));
  if (!child) return NextResponse.json({ error: 'Child member not found' }, { status: 404 });

  // 既に別の親に紐付いている場合はエラー
  if (child.parentMemberId && child.parentMemberId !== parentId) {
    return NextResponse.json(
      { error: 'Child member is already linked to another parent' },
      { status: 409 }
    );
  }

  const [updated] = await db
    .update(members)
    .set({ parentMemberId: parentId })
    .where(eq(members.id, body.childId))
    .returning();

  return NextResponse.json(updated, { status: 201 });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: parentId } = await params;
  const { searchParams } = new URL(req.url);
  const childId = searchParams.get('childId');

  if (!childId) {
    return NextResponse.json({ error: 'childId query param is required' }, { status: 400 });
  }

  const [child] = await db
    .select()
    .from(members)
    .where(and(eq(members.id, childId), eq(members.parentMemberId, parentId)));

  if (!child) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.update(members)
    .set({ parentMemberId: null })
    .where(eq(members.id, childId));

  return NextResponse.json({ ok: true });
}
