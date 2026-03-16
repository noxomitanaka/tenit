'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface AttendanceRow {
  id: string;
  memberId: string;
  memberName: string;
  method: string;
  markedAt: number;
}
interface Reservation {
  memberId: string;
  memberName: string;
  status: string;
  isSubstitution: boolean;
}
interface Member { id: string; name: string; }

export default function AttendancePage() {
  const { id: slotId } = useParams<{ id: string }>();
  const [attendances, setAttendances] = useState<AttendanceRow[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const [a, r] = await Promise.all([
      fetch(`/api/lesson-slots/${slotId}/attendance`).then(r => r.json()),
      fetch(`/api/reservations?slotId=${slotId}`).then(r => r.json()),
    ]);
    if (Array.isArray(a)) setAttendances(a);
    if (Array.isArray(r)) setReservations(r);
  }, [slotId]);

  useEffect(() => {
    refresh();
    fetch('/api/members?status=active').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setAllMembers(d);
    });
  }, [refresh]);

  async function markAttendance(memberId: string, method: 'qr' | 'manual') {
    if (attendances.find(a => a.memberId === memberId)) {
      setMessage({ type: 'err', text: '既に打刻済みです' });
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/lesson-slots/${slotId}/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, method }),
    });
    const json = await res.json();
    if (res.ok) {
      setMessage({ type: 'ok', text: `✓ ${json.memberName} の出席を記録しました` });
      await refresh();
    } else {
      setMessage({ type: 'err', text: json.error ?? '打刻に失敗しました' });
    }
    setLoading(false);
  }

  async function removeAttendance(memberId: string) {
    await fetch(`/api/lesson-slots/${slotId}/attendance?memberId=${memberId}`, { method: 'DELETE' });
    await refresh();
  }

  function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = scanInput.trim();
    if (!trimmed) return;
    setScanInput('');
    markAttendance(trimmed, 'qr');
  }

  const attendedIds = new Set(attendances.map(a => a.memberId));
  const reservedIds = new Set(reservations.filter(r => r.status === 'confirmed').map(r => r.memberId));

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/schedule" className="text-gray-400 hover:text-gray-600">←</Link>
        <h2 className="text-2xl font-bold text-gray-800">出席管理</h2>
        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
          {attendances.length}名出席
        </span>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm ${
          message.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`} onClick={() => setMessage(null)}>
          {message.text}
        </div>
      )}

      {/* QRスキャン入力 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">QRスキャン</h3>
        <form onSubmit={handleScan} className="flex gap-2">
          <input
            value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            placeholder="QRコードをスキャン（会員ID）"
            autoFocus
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button type="submit" disabled={loading || !scanInput}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
            打刻
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-2">バーコードリーダーを接続してQRをスキャンすると自動打刻されます</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 予約者リスト */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">予約者 ({reservations.filter(r => r.status === 'confirmed').length}名)</h3>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {reservations.filter(r => r.status === 'confirmed').length === 0 ? (
              <p className="p-4 text-sm text-gray-400">予約者なし</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {reservations.filter(r => r.status === 'confirmed').map(r => {
                  const attended = attendedIds.has(r.memberId);
                  return (
                    <div key={r.memberId} className={`flex items-center justify-between px-4 py-2.5 ${attended ? 'bg-emerald-50' : ''}`}>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{r.memberName}</p>
                        {r.isSubstitution && <p className="text-xs text-blue-500">振替</p>}
                      </div>
                      {attended ? (
                        <button onClick={() => removeAttendance(r.memberId)}
                          className="text-xs text-emerald-600 font-medium hover:text-red-500">
                          ✓ 出席
                        </button>
                      ) : (
                        <button onClick={() => markAttendance(r.memberId, 'manual')} disabled={loading}
                          className="text-xs text-gray-400 hover:text-emerald-600 disabled:opacity-50">
                          + 打刻
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 出席済みリスト */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">出席記録 ({attendances.length}名)</h3>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {attendances.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">まだ記録なし</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {attendances.map(a => (
                  <div key={a.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{a.memberName}</p>
                      <p className="text-xs text-gray-400">
                        {a.method === 'qr' ? '📷 QR' : '✋ 手動'} · {new Date(a.markedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button onClick={() => removeAttendance(a.memberId)}
                      className="text-xs text-red-400 hover:text-red-600">削除</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 手動追加（予約外） */}
          <div className="mt-3">
            <select onChange={e => { if (e.target.value) { markAttendance(e.target.value, 'manual'); e.target.value = ''; } }}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">＋ 会員を手動追加...</option>
              {allMembers.filter(m => !attendedIds.has(m.id)).map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
