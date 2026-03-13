import { db } from '@/db';
import { reservations, members, lessonSlots, lessons } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  confirmed: { label: '確定', color: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'キャンセル', color: 'bg-gray-100 text-gray-500' },
  absent:    { label: '欠席', color: 'bg-red-50 text-red-600' },
};

export default async function ReservationsPage() {
  const rows = await db
    .select({
      id: reservations.id,
      status: reservations.status,
      isSubstitution: reservations.isSubstitution,
      createdAt: reservations.createdAt,
      memberName: members.name,
      memberId: members.id,
      date: lessonSlots.date,
      startTime: lessonSlots.startTime,
      endTime: lessonSlots.endTime,
      lessonTitle: lessons.title,
    })
    .from(reservations)
    .innerJoin(members, eq(reservations.memberId, members.id))
    .innerJoin(lessonSlots, eq(reservations.lessonSlotId, lessonSlots.id))
    .innerJoin(lessons, eq(lessonSlots.lessonId, lessons.id))
    .orderBy(desc(lessonSlots.date), desc(lessonSlots.startTime));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">予約一覧</h2>
        <Link href="/dashboard/reservations/new"
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
          ＋ 予約を追加
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-gray-400 mb-3">予約がありません</p>
            <Link href="/dashboard/reservations/new"
              className="text-emerald-600 hover:underline text-sm">
              最初の予約を追加する
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-100">
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">日時</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">レッスン</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">会員</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">種別</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => {
                const s = STATUS_LABELS[r.status ?? 'confirmed'];
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <span className="font-medium">{r.date}</span>
                      <span className="text-gray-400 ml-2">{r.startTime}〜{r.endTime}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{r.lessonTitle}</td>
                    <td className="px-6 py-4 text-sm">
                      <Link href={`/dashboard/members/${r.memberId}`}
                        className="text-emerald-600 hover:underline">
                        {r.memberName}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {r.isSubstitution ? (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">振替</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-50 text-gray-500 rounded text-xs">通常</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs ${s.color}`}>{s.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
