import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, clubSettings } from '@/db/schema';
import { hashPassword } from '@/auth';
import { count } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
  try {
    // 既にセットアップ済みかチェック（ユーザーが1人以上いたら拒否）
    const [{ value: userCount }] = await db
      .select({ value: count() })
      .from(users);

    if (userCount > 0) {
      return NextResponse.json(
        { error: 'セットアップは既に完了しています' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { clubName, adminEmail, adminPassword, adminName } = body;

    if (!clubName || !adminEmail || !adminPassword || !adminName) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
    }

    const hashed = await hashPassword(adminPassword);

    // トランザクションで管理者ユーザーとクラブ設定を同時作成
    await db.batch([
      db.insert(users).values({
        id: randomUUID(),
        email: adminEmail,
        name: adminName,
        role: 'admin',
        hashedPassword: hashed,
      }),
      db.insert(clubSettings).values({
        name: clubName,
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[setup] error:', err);
    return NextResponse.json(
      { error: 'セットアップ中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
