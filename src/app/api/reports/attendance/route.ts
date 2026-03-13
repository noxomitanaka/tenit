/**
 * GET /api/reports/attendance
 * 出席レポート
 * クエリ: from, to, groupId, memberId
 * レスポンス: 会員別・日付別の出席集計
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { attendances, members, memberGroups, lessonSlots, lessons } from '@/db/schema';
import { eq, and, between, inArray } from 'drizzle-orm';
import { requireAdmin } from '@/lib/api-auth';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = searchParams.get('to') ?? new Date().toISOString().slice(0, 10);
  const groupId = searchParams.get('groupId');
  const memberId = searchParams.get('memberId');

  // 対象会員を絞り込む
  let targetMemberIds: string[] | null = null;

  if (memberId) {
    targetMemberIds = [memberId];
  } else if (groupId) {
    const rows = await db.select({ memberId: memberGroups.memberId })
      .from(memberGroups)
      .where(eq(memberGroups.groupId, groupId));
    targetMemberIds = rows.map(r => r.memberId);
    if (targetMemberIds.length === 0) {
      return NextResponse.json({ rows: [], summary: { totalSlots: 0, totalAttendances: 0 } });
    }
  }

  // 期間内のスロット
  const slots = await db.select({
    id: lessonSlots.id,
    date: lessonSlots.date,
    lessonTitle: lessons.title,
    startTime: lessonSlots.startTime,
  })
    .from(lessonSlots)
    .innerJoin(lessons, eq(lessonSlots.lessonId, lessons.id))
    .where(between(lessonSlots.date, from, to));

  if (slots.length === 0) {
    return NextResponse.json({ rows: [], summary: { totalSlots: 0, totalAttendances: 0 } });
  }

  const slotIds = slots.map(s => s.id);

  // 出席データ
  let attendanceQuery = db.select({
    lessonSlotId: attendances.lessonSlotId,
    memberId: attendances.memberId,
    memberName: members.name,
    method: attendances.method,
    markedAt: attendances.markedAt,
  })
    .from(attendances)
    .innerJoin(members, eq(attendances.memberId, members.id))
    .where(inArray(attendances.lessonSlotId, slotIds));

  const attendanceRows = await attendanceQuery;

  // 会員別フィルタ
  const filtered = targetMemberIds
    ? attendanceRows.filter(a => targetMemberIds!.includes(a.memberId))
    : attendanceRows;

  // 会員別集計
  const byMember: Record<string, { memberId: string; memberName: string; attended: number; slots: string[] }> = {};
  for (const a of filtered) {
    if (!byMember[a.memberId]) {
      byMember[a.memberId] = { memberId: a.memberId, memberName: a.memberName, attended: 0, slots: [] };
    }
    byMember[a.memberId].attended++;
    byMember[a.memberId].slots.push(a.lessonSlotId);
  }

  const rows = Object.values(byMember).sort((a, b) => b.attended - a.attended);

  return NextResponse.json({
    from,
    to,
    rows,
    summary: {
      totalSlots: slots.length,
      totalAttendances: filtered.length,
      uniqueMembers: rows.length,
    },
    slots: slots.map(s => ({ id: s.id, date: s.date, title: s.lessonTitle, startTime: s.startTime })),
  });
}
