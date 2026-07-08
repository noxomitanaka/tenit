import { NextResponse } from 'next/server';
import { db } from '@/db';
import { members } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { rateLimit, clientIp } from '@/lib/rate-limit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_LEVELS = ['beginner', 'intermediate', 'advanced'];
const MAX = { name: 100, nameKana: 100, email: 254, phone: 30, message: 2000 };

/** 公開エンドポイント: 入会申請（認証不要） */
export async function POST(req: Request) {
  // 公開・無認証のため乱用（総当たり・スパム）を IP 単位で抑止する
  if (!rateLimit(`join:${clientIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await req.json();
  const name = body.name?.trim();
  const email = body.email?.trim();
  const nameKana = body.nameKana?.trim();
  const phone = body.phone?.trim();
  const message = body.message?.trim();

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'invalid email format' }, { status: 400 });
  }
  if (
    name.length > MAX.name ||
    email.length > MAX.email ||
    (nameKana && nameKana.length > MAX.nameKana) ||
    (phone && phone.length > MAX.phone) ||
    (message && message.length > MAX.message)
  ) {
    return NextResponse.json({ error: 'input too long' }, { status: 400 });
  }
  if (body.level != null && !VALID_LEVELS.includes(body.level)) {
    return NextResponse.json({ error: 'invalid level' }, { status: 400 });
  }

  // 成功応答は重複有無に関わらず同一（メールアドレス列挙を防ぐ）
  const accepted = NextResponse.json(
    { message: '申請を受け付けました。管理者が承認後にご連絡します。' },
    { status: 201 }
  );

  // 既に同一メールが存在する場合は新規作成せず、存在を明かさず同じ応答を返す
  const [dup] = await db.select({ id: members.id }).from(members).where(eq(members.email, email));
  if (dup) return accepted;

  await db.insert(members).values({
    id: generateId(),
    name,
    nameKana: nameKana ?? null,
    email,
    phone: phone ?? null,
    level: body.level ?? 'beginner',
    status: 'inactive', // 管理者承認待ち
    joinedAt: new Date(),
    notes: message ?? null,
  });

  return accepted;
}
