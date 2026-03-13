import { NextResponse } from 'next/server';
import { db } from '@/db';
import { members } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { requireAdmin } from '@/lib/api-auth';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as 'active' | 'inactive' | null;
  const groupId = searchParams.get('groupId');

  // 動的なWHERE条件を構築
  // groupIdフィルタはmember_groupテーブルとのJOINが必要（Phase 2）
  const conds = [];
  if (status) conds.push(eq(members.status, status));

  const result = await db.select().from(members)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(members.createdAt);

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const [member] = await db.insert(members).values({
    id: generateId(),
    name: body.name.trim(),
    nameKana: body.nameKana?.trim() ?? null,
    email: body.email?.trim() ?? null,
    phone: body.phone?.trim() ?? null,
    level: body.level ?? 'beginner',
    status: 'active',
    joinedAt: body.joinedAt ? new Date(body.joinedAt) : new Date(),
    notes: body.notes?.trim() ?? null,
  }).returning();

  return NextResponse.json(member, { status: 201 });
}
