import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, clubSettings } from '@/db/schema';
import { hashPassword } from '@/lib/password';
import { count } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { isValidEmail } from '@/lib/validation';

export async function POST(req: Request) {
  try {
    // 既にセットアップ済みかチェック（早期リターン用）。
    // 原子的な保証はトランザクション内の再チェックで行う。
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
    if (!isValidEmail(typeof adminEmail === 'string' ? adminEmail.trim() : adminEmail)) {
      return NextResponse.json({ error: 'メールアドレスの形式が不正です' }, { status: 400 });
    }
    if (typeof adminPassword !== 'string' || adminPassword.length < 8) {
      return NextResponse.json({ error: 'パスワードは8文字以上にしてください' }, { status: 400 });
    }

    const hashed = await hashPassword(adminPassword);

    // count チェックと INSERT を単一トランザクションに包み、並行 POST での
    // admin 二重作成（TOCTOU）を防ぐ。tx 内で再度 0 件を確認してから作成する。
    try {
      await db.transaction(async (tx) => {
        const [{ value: recount }] = await tx.select({ value: count() }).from(users);
        if (recount > 0) {
          throw Object.assign(new Error('already set up'), { status: 400 });
        }
        await tx.insert(users).values({
          id: randomUUID(),
          email: adminEmail,
          name: adminName,
          role: 'admin',
          hashedPassword: hashed,
        });
        await tx.insert(clubSettings).values({ name: clubName });
      });
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 400) {
        return NextResponse.json({ error: 'セットアップは既に完了しています' }, { status: 400 });
      }
      throw e;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[setup] error:', err);
    return NextResponse.json(
      { error: 'セットアップ中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
