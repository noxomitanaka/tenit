/**
 * GET  /api/lesson-slots/[id]/attendance — スロットの出席一覧
 * POST /api/lesson-slots/[id]/attendance — 出席を打刻（QR/手動）
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { attendances, members, reservations, lessonSlots } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { requireAdmin } from '@/lib/api-auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: slotId } = await params;

  const rows = await db
    .select({
      id: attendances.id,
      memberId: attendances.memberId,
      memberName: members.name,
      method: attendances.method,
      markedAt: attendances.markedAt,
    })
    .from(attendances)
    .innerJoin(members, eq(attendances.memberId, members.id))
    .where(eq(attendances.lessonSlotId, slotId));

  return NextResponse.json(rows);
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: slotId } = await params;
  const body = await req.json();

  if (!body.memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 });
  }

  // スロット存在確認
  const [slot] = await db.select().from(lessonSlots).where(eq(lessonSlots.id, slotId));
  if (!slot) return NextResponse.json({ error: 'Slot not found' }, { status: 404 });

  // 会員存在確認
  const [member] = await db.select().from(members).where(eq(members.id, body.memberId));
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  // 重複チェック
  const [dup] = await db.select().from(attendances)
    .where(and(eq(attendances.lessonSlotId, slotId), eq(attendances.memberId, body.memberId)));
  if (dup) return NextResponse.json({ error: 'Already marked' }, { status: 409 });

  const [attendance] = await db.insert(attendances).values({
    id: generateId(),
    lessonSlotId: slotId,
    memberId: body.memberId,
    method: body.method ?? 'manual',
    markedBy: auth.session.user.id ?? null,
  }).returning();

  // 対応する予約を 'confirmed' → そのまま（出席打刻は予約statusとは独立して管理）
  // ただし予約がなければ absent扱いにしない（QR打刻は独立した出席記録）

  return NextResponse.json({ attendance, memberName: member.name }, { status: 201 });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: slotId } = await params;
  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get('memberId');
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 });

  await db.delete(attendances)
    .where(and(eq(attendances.lessonSlotId, slotId), eq(attendances.memberId, memberId)));

  return NextResponse.json({ ok: true });
}
