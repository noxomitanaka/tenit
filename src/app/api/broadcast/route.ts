/**
 * POST /api/broadcast — 一斉配信（メール / LINE）
 * GET  /api/broadcast — 配信履歴
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { broadcastMessages, members, memberGroups, clubSettings } from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { requireAdmin } from '@/lib/api-auth';
import { sendEmail } from '@/lib/email';
import { sendLinePush } from '@/lib/line';

export async function GET(_req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const list = await db.select().from(broadcastMessages).orderBy(desc(broadcastMessages.createdAt));
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const { subject, message, channel, targetType, targetId } = body;

  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'subject and message are required' }, { status: 400 });
  }
  if (!['email', 'line', 'both'].includes(channel)) {
    return NextResponse.json({ error: 'channel must be email, line, or both' }, { status: 400 });
  }

  // 対象会員を絞り込む（DB側で完結）
  let targetMembers;

  if (targetType === 'group' && targetId) {
    const groupMemberIds = await db.select({ memberId: memberGroups.memberId })
      .from(memberGroups)
      .where(eq(memberGroups.groupId, targetId));
    const ids = groupMemberIds.map(r => r.memberId);
    targetMembers = ids.length > 0
      ? await db.select().from(members).where(and(eq(members.status, 'active'), inArray(members.id, ids)))
      : [];
  } else if (targetType === 'level' && targetId) {
    targetMembers = await db.select().from(members)
      .where(and(eq(members.status, 'active'), eq(members.level, targetId)));
  } else {
    targetMembers = await db.select().from(members).where(eq(members.status, 'active'));
  }

  if (targetMembers.length === 0) {
    return NextResponse.json({ error: 'No members match the target criteria' }, { status: 400 });
  }

  // クラブ設定取得（LINE用トークン）
  const [settings] = await db.select().from(clubSettings);

  // 配信記録を先に保存（非同期送信の前に）
  const [record] = await db.insert(broadcastMessages).values({
    id: generateId(),
    subject: subject.trim(),
    body: message.trim(),
    channel,
    targetType: targetType ?? 'all',
    targetId: targetId ?? null,
    createdBy: auth.session.user.id ?? null,
  }).returning();

  // 非同期で配信（Promise.allSettled で部分失敗を許容）
  let sentCount = 0;
  const sendTasks: Promise<void>[] = [];

  for (const member of targetMembers) {
    if ((channel === 'email' || channel === 'both') && member.email) {
      sendTasks.push(
        sendEmail({
          to: member.email,
          subject: subject.trim(),
          text: message.trim(),
        }).then(() => { sentCount++; }).catch(console.error)
      );
    }
    if ((channel === 'line' || channel === 'both') && member.lineUserId && settings?.lineChannelAccessToken) {
      sendTasks.push(
        sendLinePush({
          channelAccessToken: settings.lineChannelAccessToken,
          lineUserId: member.lineUserId,
          text: `【${subject.trim()}】\n${message.trim()}`,
        }).then(() => { sentCount++; }).catch(console.error)
      );
    }
  }

  await Promise.allSettled(sendTasks);

  // 送信数を更新
  await db.update(broadcastMessages).set({
    sentCount,
    sentAt: new Date(),
  }).where(eq(broadcastMessages.id, record.id));

  return NextResponse.json({ ...record, sentCount }, { status: 201 });
}
