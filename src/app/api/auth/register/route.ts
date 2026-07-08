/**
 * POST /api/auth/register
 * 会員セルフ登録: user + member レコードを同時作成
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, members } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { hashPassword } from '@/lib/password';

export async function POST(req: Request) {
  const body = await req.json();

  if (!body.email?.trim() || !body.password || !body.name?.trim()) {
    return NextResponse.json(
      { error: 'email, password, name are required' },
      { status: 400 }
    );
  }
  if (body.password.length < 8) {
    return NextResponse.json({ error: 'password must be at least 8 characters' }, { status: 400 });
  }

  // メール重複チェック
  const [existing] = await db.select().from(users).where(eq(users.email, body.email.trim()));
  if (existing) {
    return NextResponse.json({ error: 'email already registered' }, { status: 409 });
  }

  const hashedPassword = await hashPassword(body.password);
  const userId = generateId();
  const memberId = generateId();

  // user と member を単一トランザクションで作成（片方だけ残る不整合を防ぐ）。
  // status は inactive（承認待ち）。管理者承認まで会員機能は使えない
  // （requireMember が active 以外を 403）。self-registration の即時アクティブ化は
  // 未承認の外部者が会員データに到達する経路になるため禁止する。
  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: userId,
      email: body.email.trim(),
      name: body.name.trim(),
      role: 'member',
      hashedPassword,
    });

    await tx.insert(members).values({
      id: memberId,
      userId,
      name: body.name.trim(),
      nameKana: body.nameKana?.trim() ?? null,
      email: body.email.trim(),
      phone: body.phone?.trim() ?? null,
      status: 'inactive',
      joinedAt: new Date(),
    });
  });

  return NextResponse.json({ ok: true, memberId, status: 'pending_approval' }, { status: 201 });
}
