'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Member { id: string; name: string; }
interface Slot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  lessonTitle: string;
}
interface Credit { id: string; expiresAt: string; }

export default function NewReservationPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [memberId, setMemberId] = useState('');
  const [slotId, setSlotId] = useState('');
  const [isSubstitution, setIsSubstitution] = useState(false);
  const [creditId, setCreditId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 会員リスト取得
  useEffect(() => {
    fetch('/api/members').then(r => r.json()).then((d: { members: Member[] }) => {
      if (Array.isArray(d.members)) setMembers(d.members);
    });
  }, []);

  // 今後30日のスロット取得
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const to = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
    fetch(`/api/lesson-slots?from=${today}&to=${to}`)
      .then(r => r.json())
      .then((data: Array<{ id: string; date: string; startTime: string; endTime: string; lessonId: string }>) => {
        if (!Array.isArray(data)) return;
        // lessonTitle は別途 API で取得する仕組みにするか、lesson-slots API に含める
        // ここでは暫定的に id を表示
        setSlots(data.map(s => ({
          id: s.id,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          lessonTitle: s.lessonId,
        })));
      });
  }, []);

  // 会員変更時に振替クレジット取得
  useEffect(() => {
    if (!memberId) { setCredits([]); return; }
    fetch(`/api/substitution-credits?memberId=${memberId}`)
      .then(r => r.json())
      .then((data: { credits: Credit[] }) => {
        if (Array.isArray(data.credits)) setCredits(data.credits);
        else setCredits([]);
      });
  }, [memberId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lessonSlotId: slotId,
        memberId,
        isSubstitution,
        creditId: isSubstitution && creditId ? creditId : undefined,
      }),
    });
    if (res.ok) {
      router.push('/dashboard/reservations');
    } else {
      setError((await res.json()).error ?? '予約に失敗しました');
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/reservations" className="text-gray-400 hover:text-gray-600">←</Link>
        <h2 className="text-2xl font-bold text-gray-800">予約を追加</h2>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">会員 <span className="text-red-500">*</span></label>
          <select required value={memberId} onChange={e => setMemberId(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">選択してください</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">レッスン枠 <span className="text-red-500">*</span></label>
          <select required value={slotId} onChange={e => setSlotId(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">選択してください</option>
            {slots.map(s => (
              <option key={s.id} value={s.id}>
                {s.date} {s.startTime}〜{s.endTime}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" id="isSubstitution" checked={isSubstitution}
            onChange={e => { setIsSubstitution(e.target.checked); setCreditId(''); }}
            className="w-4 h-4 text-emerald-600 rounded" />
          <label htmlFor="isSubstitution" className="text-sm text-gray-700">振替レッスンとして予約</label>
        </div>

        {isSubstitution && credits.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">使用する振替クレジット</label>
            <select value={creditId} onChange={e => setCreditId(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">指定しない</option>
              {credits.map(c => (
                <option key={c.id} value={c.id}>
                  有効期限: {new Date(c.expiresAt).toLocaleDateString('ja-JP')}
                </option>
              ))}
            </select>
          </div>
        )}

        {isSubstitution && credits.length === 0 && memberId && (
          <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-xl">
            この会員の有効な振替クレジットがありません。振替枠として登録することも可能です。
          </p>
        )}

        <button type="submit" disabled={loading}
          className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
          {loading ? '処理中...' : '予約を確定する'}
        </button>
      </form>
    </div>
  );
}
