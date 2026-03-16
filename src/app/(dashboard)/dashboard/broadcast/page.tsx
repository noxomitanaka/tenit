'use client';
import { useState, useEffect } from 'react';

interface BroadcastRecord {
  id: string;
  subject: string;
  channel: string;
  targetType: string;
  targetId: string | null;
  sentCount: number;
  sentAt: number | null;
  createdAt: number;
}
interface Group { id: string; name: string; }

const CHANNEL_LABELS: Record<string, string> = { email: 'メールのみ', line: 'LINEのみ', both: 'メール+LINE' };
const TARGET_LABELS: Record<string, string> = { all: '全会員', group: 'グループ', level: 'レベル別' };

export default function BroadcastPage() {
  const [history, setHistory] = useState<BroadcastRecord[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [targetType, setTargetType] = useState('all');
  const [channel, setChannel] = useState('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch('/api/broadcast').then(r => r.json()).then(d => { if (Array.isArray(d)) setHistory(d); });
    fetch('/api/groups').then(r => r.json()).then(d => { if (Array.isArray(d)) setGroups(d); });
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    const form = e.currentTarget;
    const get = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;

    const res = await fetch('/api/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: get('subject'),
        message: get('message'),
        channel,
        targetType,
        targetId: targetType !== 'all' ? get('targetId') : undefined,
      }),
    });

    const json = await res.json();
    if (res.ok) {
      setSuccess(`配信完了: ${json.sentCount}件送信しました`);
      form.reset();
      setTargetType('all');
      // 履歴を再取得
      fetch('/api/broadcast').then(r => r.json()).then(d => { if (Array.isArray(d)) setHistory(d); });
    } else {
      setError(json.error ?? '配信に失敗しました');
    }
    setLoading(false);
  }

  return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">一斉配信</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 配信フォーム */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">新規配信</h3>

          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}
          {success && <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm">{success}</div>}

          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">チャンネル</label>
              <select value={channel} onChange={e => setChannel(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="email">メールのみ</option>
                <option value="line">LINEのみ</option>
                <option value="both">メール + LINE</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">対象</label>
              <select value={targetType} onChange={e => setTargetType(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="all">全会員</option>
                <option value="group">グループ</option>
                <option value="level">レベル別</option>
              </select>
            </div>

            {targetType === 'group' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">グループ選択</label>
                <select name="targetId"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="">選択してください</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}

            {targetType === 'level' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">レベル</label>
                <select name="targetId"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="beginner">初級</option>
                  <option value="intermediate">中級</option>
                  <option value="advanced">上級</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">件名 <span className="text-red-500">*</span></label>
              <input name="subject" required
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="クラブからのお知らせ" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">本文 <span className="text-red-500">*</span></label>
              <textarea name="message" required rows={5}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                placeholder="お知らせの内容を入力..." />
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {loading ? '配信中...' : '配信する'}
            </button>
          </form>
        </div>

        {/* 配信履歴 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">配信履歴</h3>
          {history.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100">
              <p className="text-gray-400 text-sm">配信履歴がありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map(h => (
                <div key={h.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <p className="text-sm font-medium text-gray-800 truncate">{h.subject}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">{CHANNEL_LABELS[h.channel]}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{TARGET_LABELS[h.targetType]}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-emerald-600 font-medium">{h.sentCount}件</span>
                  </div>
                  {h.sentAt && (
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(h.sentAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
