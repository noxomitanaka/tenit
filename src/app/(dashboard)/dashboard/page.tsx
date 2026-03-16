import { db } from '@/db';
import { members, reservations, lessonSlots, substitutionCredits, monthlyFees } from '@/db/schema';
import { eq, and, isNull, gte, sql, inArray } from 'drizzle-orm';
import Link from 'next/link';

export default async function DashboardPage() {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  const [memberRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(members)
    .where(eq(members.status, 'active'));

  const [todayRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(reservations)
    .innerJoin(lessonSlots, eq(reservations.lessonSlotId, lessonSlots.id))
    .where(and(eq(reservations.status, 'confirmed'), eq(lessonSlots.date, today)));

  const [creditRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(substitutionCredits)
    .where(and(isNull(substitutionCredits.usedAt), gte(substitutionCredits.expiresAt, now)));

  const thisMonth = now.toISOString().slice(0, 7);
  const [overdueRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(monthlyFees)
    .where(and(
      inArray(monthlyFees.status, ['pending', 'overdue']),
      eq(monthlyFees.month, thisMonth),
    ));

  const stats = [
    { label: '今日の予約', value: Number(todayRow?.count ?? 0), unit: '件', color: 'blue' },
    { label: 'アクティブ会員', value: Number(memberRow?.count ?? 0), unit: '名', color: 'emerald' },
    { label: '振替残数（全体）', value: Number(creditRow?.count ?? 0), unit: '件', color: 'amber' },
    { label: '今月未払い', value: Number(overdueRow?.count ?? 0), unit: '件', color: 'red' },
  ] as const;

  const colorMap = {
    blue: 'text-blue-600',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">ダッシュボード</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${colorMap[stat.color]}`}>
              {stat.value}
              <span className="text-sm font-normal text-gray-400 ml-1">{stat.unit}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-4">クイックアクション</h3>
          <div className="space-y-2">
            <Link href="/dashboard/members/new"
              className="block px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-sm hover:bg-emerald-100 transition-colors">
              ＋ 会員を追加する
            </Link>
            <Link href="/dashboard/schedule"
              className="block px-4 py-2.5 bg-blue-50 text-blue-700 rounded-xl text-sm hover:bg-blue-100 transition-colors">
              📅 スケジュールを見る
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-4">システム情報</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">バージョン</dt>
              <dd className="font-medium text-gray-700">Phase 1</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">ライセンス</dt>
              <dd className="font-medium text-gray-700">AGPL-3.0</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
