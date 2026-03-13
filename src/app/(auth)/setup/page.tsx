'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<'check' | 'form' | 'done'>('check');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    clubName: '',
    adminEmail: '',
    adminPassword: '',
    adminPasswordConfirm: '',
    adminName: '',
  });

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    if (form.adminPassword !== form.adminPasswordConfirm) {
      setError('パスワードが一致しません');
      return;
    }
    if (form.adminPassword.length < 8) {
      setError('パスワードは8文字以上にしてください');
      return;
    }

    setLoading(true);
    setError('');

    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clubName: form.clubName,
        adminEmail: form.adminEmail,
        adminPassword: form.adminPassword,
        adminName: form.adminName,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'セットアップに失敗しました');
    } else {
      setStep('done');
    }
    setLoading(false);
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm p-8 text-center space-y-4">
          <div className="text-4xl">🎉</div>
          <h2 className="text-xl font-bold text-gray-800">セットアップ完了！</h2>
          <p className="text-sm text-gray-500">
            管理者アカウントが作成されました。
            <br />
            ログインページからサインインしてください。
          </p>
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-emerald-600 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
          >
            ログインページへ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-emerald-700">🎾 Tenit</h1>
          <p className="text-sm text-gray-500 mt-1">初回セットアップ</p>
        </div>

        <form onSubmit={handleSetup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              クラブ名 / スクール名
            </label>
            <input
              type="text"
              value={form.clubName}
              onChange={(e) => setForm({ ...form, clubName: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="○○テニスクラブ"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              管理者名
            </label>
            <input
              type="text"
              value={form.adminName}
              onChange={(e) => setForm({ ...form, adminName: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="田中 太郎"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              管理者メールアドレス
            </label>
            <input
              type="email"
              value={form.adminEmail}
              onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              パスワード（8文字以上）
            </label>
            <input
              type="password"
              value={form.adminPassword}
              onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              パスワード（確認）
            </label>
            <input
              type="password"
              value={form.adminPasswordConfirm}
              onChange={(e) => setForm({ ...form, adminPasswordConfirm: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'セットアップ中...' : 'セットアップ開始'}
          </button>
        </form>
      </div>
    </div>
  );
}
