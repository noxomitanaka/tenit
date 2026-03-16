import { db } from '@/db';
import { tournaments } from '@/db/schema';
import { desc } from 'drizzle-orm';
import Link from 'next/link';

const TYPE_LABELS: Record<string, string> = {
  swiss: 'スイスドロー',
  elimination: 'シングルエリミネーション',
  round_robin: 'ラウンドロビン',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-blue-50 text-blue-600',
};
const STATUS_LABELS: Record<string, string> = {
  draft: '準備中', active: '開催中', completed: '終了',
};

export default async function TournamentsPage() {
  const list = await db.select().from(tournaments).orderBy(desc(tournaments.createdAt));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">大会管理</h2>
        <Link href="/dashboard/tournaments/new"
          className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
          ＋ 大会を作成
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center">
          <p className="text-4xl mb-3">🏆</p>
          <p className="text-gray-400 mb-3">大会がまだありません</p>
          <Link href="/dashboard/tournaments/new" className="text-emerald-600 hover:underline text-sm">
            最初の大会を作成する
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map(t => (
            <Link key={t.id} href={`/dashboard/tournaments/${t.id}`}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">{t.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{TYPE_LABELS[t.type]}</p>
                  {t.date && <p className="text-xs text-gray-400 mt-1">{t.date}</p>}
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[t.status]}`}>
                  {STATUS_LABELS[t.status]}
                </span>
              </div>
              {t.maxParticipants && (
                <p className="text-xs text-gray-400 mt-3">定員: {t.maxParticipants}名</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
