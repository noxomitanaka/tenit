import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Logo */}
        <div>
          <h1 className="text-5xl font-bold text-emerald-700 tracking-tight">🎾 Tenit</h1>
          <p className="mt-3 text-lg text-gray-600">
            テニスクラブ・スクール管理ツール
          </p>
          <p className="text-sm text-gray-400">
            Open-source tennis club management
          </p>
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <Link
            href="/login"
            className="block w-full bg-emerald-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-emerald-700 transition-colors"
          >
            ログイン
          </Link>
          <Link
            href="/setup"
            className="block w-full bg-white text-emerald-700 border border-emerald-300 py-3 px-6 rounded-xl font-medium hover:bg-emerald-50 transition-colors"
          >
            初回セットアップ
          </Link>
        </div>

        {/* Features */}
        <div className="text-left bg-white rounded-xl p-6 shadow-sm space-y-3">
          {[
            '会員管理・グループ管理',
            'コートスケジュール・予約',
            '振替レッスン管理',
            '大会・イベント管理',
            'LINE / メール通知',
          ].map((f) => (
            <div key={f} className="flex items-center gap-3 text-sm text-gray-700">
              <span className="text-emerald-500">✓</span>
              {f}
            </div>
          ))}
        </div>

        {/* OSS badge */}
        <p className="text-xs text-gray-400">
          AGPL-3.0 ·{' '}
          <a
            href="https://github.com/noxomitanaka/tenit"
            className="underline hover:text-emerald-600"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </p>
      </div>
    </main>
  );
}
