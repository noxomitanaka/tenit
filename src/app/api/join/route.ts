import { NextResponse } from 'next/server';
import { db } from '@/db';
import { members } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/id';

/** 公開エンドポイント: 入会申請（認証不要） */
export async function POST(req: Request) {
  const body = await req.json();

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!body.email?.trim()) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  // メール重複チェック
  const [dup] = await db.select().from(members).where(eq(members.email, body.email.trim()));
  if (dup) {
    return NextResponse.json(
      { error: '既に登録済みのメールアドレスです' },
      { status: 409 }
    );
  }

  await db.insert(members).values({
    id: generateId(),
    name: body.name.trim(),
    nameKana: body.nameKana?.trim() ?? null,
    email: body.email.trim(),
    phone: body.phone?.trim() ?? null,
    level: body.level ?? 'beginner',
    status: 'inactive', // 管理者承認待ち
    joinedAt: new Date(),
    notes: body.message?.trim() ?? null,
  });

  return NextResponse.json(
    { message: '申請を受け付けました。管理者が承認後にご連絡します。' },
    { status: 201 }
  );
}
