'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewTournamentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [type, setType] = useState('swiss');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const get = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement).value;

    const res = await fetch('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: get('name'),
        type: get('type'),
        date: get('date') || null,
        rounds: get('rounds') ? Number(get('rounds')) : undefined,
        maxParticipants: get('maxParticipants') ? Number(get('maxParticipants')) : undefined,
        notes: get('notes'),
      }),
    });

    if (res.ok) {
      const t = await res.json();
      router.push(`/dashboard/tournaments/${t.id}`);
    } else {
      setError((await res.json()).error ?? '作成に失敗しました');
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/tournaments" className="text-gray-400 hover:text-gray-600">←</Link>
        <h2 className="text-2xl font-bold text-gray-800">大会を作成</h2>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">大会名 <span className="text-red-500">*</span></label>
          <input name="name" required placeholder="春季オープン大会"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">形式</label>
          <select name="type" value={type} onChange={e => setType(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="swiss">スイスドロー</option>
            <option value="elimination">シングルエリミネーション</option>
            <option value="round_robin">ラウンドロビン（総当たり）</option>
          </select>
        </div>

        {type === 'swiss' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ラウンド数</label>
            <input name="rounds" type="number" min="2" max="10" defaultValue="3"
              className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">開催日</label>
            <input name="date" type="date"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">定員</label>
            <input name="maxParticipants" type="number" min="2" placeholder="無制限"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">メモ（任意）</label>
          <textarea name="notes" rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
          {loading ? '作成中...' : '大会を作成'}
        </button>
      </form>
    </div>
  );
}
