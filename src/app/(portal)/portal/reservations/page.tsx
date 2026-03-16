'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Row {
  id: string;
  status: string;
  isSubstitution: boolean;
  date: string;
  startTime: string;
  endTime: string;
  lessonTitle: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  confirmed: { label: '確定', color: 'text-emerald-600' },
  cancelled: { label: 'キャンセル', color: 'text-gray-400' },
  absent:    { label: '欠席', color: 'text-red-500' },
};

export default function PortalReservationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/portal/reservations').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setRows(d);
    });
  }, []);

  async function cancel(id: string) {
    if (!confirm('予約をキャンセルしますか？\n通常予約のキャンセルは振替クレジットに変換されます。')) return;
    setCancelling(id);
    const res = await fetch(`/api/portal/reservations/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setRows(prev => prev.map(r => r.id === id ? { ...r, status: 'cancelled' } : r));
    }
    setCancelling(null);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">予約履歴</h1>
        <Link href="/portal/book" className="text-sm text-emerald-600 hover:underline">
          ＋ 新規予約
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
          <p className="text-gray-400">予約がありません</p>
          <Link href="/portal/book" className="text-emerald-600 hover:underline text-sm mt-2 inline-block">
            レッスンを予約する
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => {
            const s = STATUS_LABELS[r.status ?? 'confirmed'];
            const isFuture = r.date >= today;
            return (
              <div key={r.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-800">{r.date}
                      <span className="text-gray-400 ml-2 font-normal text-sm">{r.startTime}〜{r.endTime}</span>
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">{r.lessonTitle}</p>
                    <div className="flex gap-2 mt-1">
                      <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>
                      {r.isSubstitution && <span className="text-xs text-blue-500">振替</span>}
                    </div>
                  </div>
                  {r.status === 'confirmed' && isFuture && (
                    <button onClick={() => cancel(r.id)} disabled={cancelling === r.id}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 border border-red-200 px-2 py-1 rounded-xl">
                      {cancelling === r.id ? '...' : 'キャンセル'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
