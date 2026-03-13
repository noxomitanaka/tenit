import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-emerald-700">🎾 Tenit</h1>
          <div className="text-sm text-gray-500">
            {session.user.name} ({session.user.role === 'admin' ? '管理者' : session.user.role === 'coach' ? 'コーチ' : '会員'})
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">ダッシュボード</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: '今日の予約', value: '-', unit: '件' },
            { label: 'アクティブ会員', value: '-', unit: '名' },
            { label: '振替残数（全体）', value: '-', unit: '件' },
            { label: '今月の稼働率', value: '-', unit: '%' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {stat.value}
                <span className="text-sm font-normal text-gray-400 ml-1">{stat.unit}</span>
              </p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-gray-500 text-sm text-center py-8">
            Phase 1 実装中...
            <br />
            会員管理・コートスケジュール・振替レッスン機能を開発中です
          </p>
        </div>
      </main>
    </div>
  );
}
