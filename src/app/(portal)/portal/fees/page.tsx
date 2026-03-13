'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface FeeRow {
  id: string;
  month: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'waived';
  paidAt: number | null;
}

const STATUS_LABELS: Record<FeeRow['status'], { label: string; color: string }> = {
  pending: { label: '未払い', color: 'text-yellow-600' },
  paid:    { label: '支払済', color: 'text-emerald-600' },
  overdue: { label: '滞納',   color: 'text-red-600' },
  waived:  { label: '免除',   color: 'text-gray-400' },
};

function FeesContent() {
  const searchParams = useSearchParams();
  const justPaid = searchParams.get('paid') === '1';

  const [rows, setRows] = useState<FeeRow[]>([]);
  const [paying, setPaying] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/portal/fees').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setRows(d);
    });
  }, []);

  async function pay(id: string) {
    setPaying(id);
    const res = await fetch(`/api/fees/${id}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        successUrl: `${window.location.origin}/portal/fees?paid=1`,
        cancelUrl: `${window.location.origin}/portal/fees`,
      }),
    });
    if (res.ok) {
      const { url } = await res.json();
      if (url) window.location.href = url;
    } else {
      const err = await res.json();
      alert(err.error ?? '決済ページの作成に失敗しました');
    }
    setPaying(null);
  }

  const unpaid = rows.filter(r => r.status === 'pending' || r.status === 'overdue');
  const totalUnpaid = unpaid.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-800">月謝</h1>

      {justPaid && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700 text-sm">
          お支払いありがとうございました。
        </div>
      )}

      {unpaid.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm font-medium text-yellow-800">
            未払いの月謝が {unpaid.length} 件あります（合計 ¥{totalUnpaid.toLocaleString()}）
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
          <p className="text-gray-400">月謝の記録がありません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => {
            const s = STATUS_LABELS[r.status];
            return (
              <div key={r.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-800">{r.month}</p>
                    <p className="text-sm text-gray-500">¥{r.amount.toLocaleString()}</p>
                    <p className={`text-xs mt-0.5 font-medium ${s.color}`}>{s.label}</p>
                    {r.paidAt && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(r.paidAt).toLocaleDateString('ja-JP')} 支払済
                      </p>
                    )}
                  </div>
                  {(r.status === 'pending' || r.status === 'overdue') && (
                    <button onClick={() => pay(r.id)} disabled={paying === r.id}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                      {paying === r.id ? '処理中...' : 'カードで支払う'}
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

export default function PortalFeesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">読み込み中...</div>}>
      <FeesContent />
    </Suspense>
  );
}
