'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Lesson { id: string; title: string; recurringDayOfWeek: number | null; startTime: string; }

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export default function GenerateSlotsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(nextMonth);
  const [lessonId, setLessonId] = useState('');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; message?: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/lessons?isRecurring=true').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setLessons(d.filter((l: Lesson) => l.recurringDayOfWeek !== null));
    });
  }, []);

  async function handleGenerate() {
    setLoading(true);
    setError('');
    setResult(null);
    const res = await fetch('/api/lesson-slots/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, lessonId: lessonId || undefined }),
    });
    const json = await res.json();
    if (res.ok || res.status === 200) {
      setResult(json);
    } else {
      setError(json.error ?? 'スロット生成に失敗しました');
    }
    setLoading(false);
  }

  return (
    <div className="p-8 max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/schedule" className="text-gray-400 hover:text-gray-600">←</Link>
        <h2 className="text-2xl font-bold text-gray-800">スロット一括生成</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">開始日</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">終了日</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">対象レッスン</label>
          <select value={lessonId} onChange={e => setLessonId(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">すべての定期レッスン</option>
            {lessons.map(l => (
              <option key={l.id} value={l.id}>
                {l.title}（{l.recurringDayOfWeek !== null ? DAY_LABELS[l.recurringDayOfWeek] : '?'}曜 {l.startTime}~）
              </option>
            ))}
          </select>
          {lessons.length === 0 && (
            <p className="text-xs text-gray-400 mt-1">定期レッスンが登録されていません</p>
          )}
        </div>

        <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
          既存のスロットは重複生成しません。最大90日間の範囲で生成できます。
        </div>

        {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}

        {result && (
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm">
            {result.created > 0
              ? `✓ ${result.created}件のスロットを生成しました`
              : result.message ?? '生成完了'}
          </div>
        )}

        <button onClick={handleGenerate} disabled={loading || lessons.length === 0}
          className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
          {loading ? '生成中...' : 'スロットを生成'}
        </button>
      </div>
    </div>
  );
}
