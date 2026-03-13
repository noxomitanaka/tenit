import { db } from '@/db';
import { auth } from '@/auth';
import { members, reservations, lessonSlots, substitutionCredits } from '@/db/schema';
import { eq, and, isNull, gte, desc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function PortalPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [member] = await db.select().from(members).where(eq(members.userId, session.user.id));
  if (!member) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">会員プロフィールが見つかりません。管理者にお問い合わせください。</p>
      </div>
    );
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // 今後の予約
  const upcoming = await db
    .select({ id: reservations.id, date: lessonSlots.date, startTime: lessonSlots.startTime, endTime: lessonSlots.endTime })
    .from(reservations)
    .innerJoin(lessonSlots, eq(reservations.lessonSlotId, lessonSlots.id))
    .where(and(eq(reservations.memberId, member.id), eq(reservations.status, 'confirmed'), gte(lessonSlots.date, today)))
    .orderBy(lessonSlots.date, lessonSlots.startTime)
    .limit(5);

  // 有効な振替クレジット数
  const activeCredits = await db.select().from(substitutionCredits)
    .where(and(eq(substitutionCredits.memberId, member.id), isNull(substitutionCredits.usedAt), gte(substitutionCredits.expiresAt, now)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{member.name} さん</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          レベル: {member.level === 'beginner' ? '初級' : member.level === 'intermediate' ? '中級' : '上級'}
        </p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500">今後の予約</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{upcoming.length}<span className="text-sm font-normal text-gray-400 ml-1">件</span></p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500">振替クレジット</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{activeCredits.length}<span className="text-sm font-normal text-gray-400 ml-1">件</span></p>
        </div>
      </div>

      {/* 今後の予約リスト */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-700">今後の予約</h2>
          <Link href="/portal/reservations" className="text-xs text-emerald-600 hover:underline">すべて見る</Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">予約はありません</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {upcoming.map(r => (
              <li key={r.id} className="py-3 flex justify-between text-sm">
                <span className="font-medium text-gray-800">{r.date}</span>
                <span className="text-gray-500">{r.startTime}〜{r.endTime}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* クイックアクション */}
      <Link href="/portal/book"
        className="block w-full bg-emerald-600 text-white py-3 rounded-xl text-center font-medium hover:bg-emerald-700 transition-colors">
        レッスンを予約する
      </Link>
    </div>
  );
}
