import { db } from '@/db';
import { members } from '@/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';

const LEVEL_LABELS: Record<string, string> = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
};

export default async function MembersPage() {
  const memberList = await db.select().from(members)
    .where(eq(members.status, 'active'))
    .orderBy(members.createdAt);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">会員管理</h2>
        <Link href="/dashboard/members/new"
          className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
          ＋ 会員を追加
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {memberList.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-gray-400 mb-3">会員が登録されていません</p>
            <Link href="/dashboard/members/new"
              className="text-emerald-600 hover:underline text-sm">
              最初の会員を追加する
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-100">
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">氏名</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">フリガナ</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">メール</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">電話</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">レベル</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {memberList.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{m.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{m.nameKana ?? '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{m.email ?? '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{m.phone ?? '-'}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs">
                      {LEVEL_LABELS[m.level ?? 'beginner'] ?? m.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    <Link href={`/dashboard/members/${m.id}`}
                      className="text-emerald-600 hover:text-emerald-800 font-medium">
                      詳細
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
