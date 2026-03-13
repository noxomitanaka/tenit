'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Slot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  lessonId: string;
}
interface Credit { id: string; expiresAt: string; }

export default function PortalBookPage() {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [slotId, setSlotId] = useState('');
  const [isSubstitution, setIsSubstitution] = useState(false);
  const [creditId, setCreditId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const to = new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10);
    fetch(`/api/lesson-slots?from=${today}&to=${to}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setSlots(d.filter((s: Slot) => s.status === 'open')); });
    fetch('/api/substitution-credits')
      .then(r => r.json())
      .then((d: { credits: Credit[] }) => { if (Array.isArray(d.credits)) setCredits(d.credits); });
  }, []);

  async function handleBook() {
    if (!slotId) { setError('レッスン枠を選択してください'); return; }
    setLoading(true);
    setError('');
    const res = await fetch('/api/portal/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lessonSlotId: slotId,
        isSubstitution,
        creditId: isSubstitution && creditId ? creditId : undefined,
      }),
    });
    if (res.ok) {
      setSuccess(true);
      setTimeout(() => router.push('/portal/reservations'), 1500);
    } else {
      setError((await res.json()).error ?? '予約に失敗しました');
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">✅</div>
        <p className="font-semibold text-gray-700">予約を受け付けました</p>
        <p className="text-sm text-gray-400 mt-1">予約履歴に移動します...</p>
      </div>
    );
  }

  // 日付でグループ化
  const byDate = slots.reduce<Record<string, Slot[]>>((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-800">レッスン予約</h1>

      {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* 振替チェック */}
      {credits.length > 0 && (
        <div className="bg-blue-50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <input type="checkbox" id="isSubstitution" checked={isSubstitution}
              onChange={e => { setIsSubstitution(e.target.checked); setCreditId(''); }}
              className="w-4 h-4 text-blue-600" />
            <label htmlFor="isSubstitution" className="text-sm font-medium text-blue-800">
              振替クレジットを使用（残 {credits.length}件）
            </label>
          </div>
          {isSubstitution && (
            <select value={creditId} onChange={e => setCreditId(e.target.value)}
              className="mt-2 w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
              <option value="">クレジットを選択（任意）</option>
              {credits.map(c => (
                <option key={c.id} value={c.id}>
                  期限: {new Date(c.expiresAt).toLocaleDateString('ja-JP')}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* 枠選択 */}
      {Object.keys(byDate).length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
          <p className="text-gray-400">予約可能なレッスン枠がありません</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byDate).sort().map(([date, daySlots]) => (
            <div key={date} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-600">{date}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {daySlots.map(s => (
                  <button key={s.id} onClick={() => setSlotId(s.id)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                      slotId === s.id ? 'bg-emerald-50 border-l-2 border-emerald-500' : ''
                    }`}>
                    <span className="text-sm text-gray-700">{s.startTime}〜{s.endTime}</span>
                    {slotId === s.id && <span className="text-xs text-emerald-600 font-medium">選択中</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {slotId && (
        <button onClick={handleBook} disabled={loading}
          className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors sticky bottom-4">
          {loading ? '処理中...' : `${isSubstitution ? '振替' : ''}予約を確定する`}
        </button>
      )}
    </div>
  );
}
