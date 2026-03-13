'use client';
import { useState, useEffect } from 'react';

interface Settings {
  name: string;
  substitutionDeadlineDays: number;
  lineChannelAccessToken: string | null;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then((d: Settings) => {
      if (d.name) setSettings(d);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    setError('');
    const form = e.currentTarget;
    const get = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;

    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: get('name'),
        substitutionDeadlineDays: Number(get('substitutionDeadlineDays')),
        lineChannelAccessToken: get('lineChannelAccessToken') || null,
        lineChannelSecret: get('lineChannelSecret') || null,
      }),
    });

    if (res.ok) {
      setSettings(await res.json());
      setSaved(true);
    } else {
      setError((await res.json()).error ?? '保存に失敗しました');
    }
    setLoading(false);
  }

  if (!settings) return <div className="p-8 text-gray-400">読み込み中...</div>;

  return (
    <div className="p-8 max-w-xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">クラブ設定</h2>

      {saved && (
        <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm">設定を保存しました</div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 基本設定 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h3 className="font-semibold text-gray-700">基本設定</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">クラブ名</label>
            <input name="name" required defaultValue={settings.name}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              振替期限（日）
              <span className="text-gray-400 font-normal ml-2">欠席・キャンセルからの振替有効期間</span>
            </label>
            <input name="substitutionDeadlineDays" type="number" min="1" max="365"
              defaultValue={settings.substitutionDeadlineDays}
              className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>

        {/* LINE設定 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-700">LINE Messaging API</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              予約確認・振替リマインドの LINE 通知に使用します。未設定の場合はメールのみ送信されます。
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Channel Access Token</label>
            <input name="lineChannelAccessToken" type="text"
              defaultValue={settings.lineChannelAccessToken ?? ''}
              placeholder="設定済み"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Channel Secret
              <span className="text-gray-400 font-normal ml-2">（webhook 署名検証用）</span>
            </label>
            <input name="lineChannelSecret" type="password"
              placeholder="変更する場合のみ入力"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
            <p className="font-medium text-gray-600 mb-1">Webhook URL（LINE 開発者コンソールに設定）</p>
            <p className="font-mono">{typeof window !== 'undefined' ? window.location.origin : ''}/api/line/webhook</p>
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
          {loading ? '保存中...' : '設定を保存'}
        </button>
      </form>
    </div>
  );
}
