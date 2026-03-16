import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { db } from '@/db';
import { members } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { Member } from '@/db/schema';

type AuthOk = { ok: true; session: Session & { user: NonNullable<Session['user']> } };
type AuthFail = { ok: false; response: NextResponse };
export type AuthResult = AuthOk | AuthFail;

type MemberAuthOk = AuthOk & { member: Member };
export type MemberAuthResult = MemberAuthOk | AuthFail;

export async function requireAuth(): Promise<AuthResult> {
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { ok: true, session: session as AuthOk['session'] };
}

export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireAuth();
  if (!result.ok) return result;
  if (result.session.user.role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  return result;
}

/** admin または coach のみ通過（スケジュール管理・出欠管理用） */
export async function requireCoach(): Promise<AuthResult> {
  const result = await requireAuth();
  if (!result.ok) return result;
  const role = result.session.user.role;
  if (role !== 'admin' && role !== 'coach') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  return result;
}

/** admin または staff のみ通過（会員・予約閲覧用） */
export async function requireStaff(): Promise<AuthResult> {
  const result = await requireAuth();
  if (!result.ok) return result;
  const role = result.session.user.role;
  if (role !== 'admin' && role !== 'staff') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  return result;
}

/** ログイン済みかつ members テーブルに紐付いているユーザー専用 */
export async function requireMember(): Promise<MemberAuthResult> {
  const result = await requireAuth();
  if (!result.ok) return result;

  const userId = result.session.user.id;
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const [member] = await db.select().from(members).where(eq(members.userId, userId));
  if (!member) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No member profile linked to this account' }, { status: 403 }),
    };
  }

  return { ok: true, session: result.session, member };
}
