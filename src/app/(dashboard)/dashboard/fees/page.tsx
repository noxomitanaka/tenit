'use client';
import { useState, useEffect } from 'react';

interface FeeRow {
  id: string;
  memberId: string;
  memberName: string;
  month: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'waived';
  paidAt: number | null;
  notes: string | null;
}

const STATUS_LABELS: Record<FeeRow['status'], { label: string; color: string; bg: string }> = {
  pending:  { label: '未払い',  color: 'text-yellow-700', bg: 'bg-yellow-50' },
  paid:     { label: '支払済',  color: 'text-emerald-700', bg: 'bg-emerald-50' },
  overdue:  { label: '滞納',    color: 'text-red-700',  bg: 'bg-red-50' },
  waived:   { label: '免除',    color: 'text-gray-500',  bg: 'bg-gray-50' },
};

export default function FeesPage() {
  const thisMonth = new Date().toISOString().slice(0, 7);

  const [month, setMonth] = useState(thisMonth);
  const [statusFilter, setStatusFilter] = useState('');
  const [rows, setRows] = useState<FeeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { fetchFees(); }, [month, statusFilter]);

  async function fetchFees() {
    setLoading(true);
    const params = new URLSearchParams({ month });
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/fees?${params}`);
    const json = await res.json();
    if (Array.isArray(json)) setRows(json);
    setLoading(false);
  }

  async function generateFees() {
    if (!confirm(`${month} の月謝レコードを全アクティブ会員分生成しますか？`)) return;
    setGenerating(true);
    const res = await fetch('/api/fees/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month }),
    });
    const json = await res.json();
    setMessage(`${json.created} 件作成、${json.skipped} 件スキップ`);
    await fetchFees();
    setGenerating(false);
  }

  async function updateStatus(id: string, status: FeeRow['status']) {
    const res = await fetch(`/api/fees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setRows(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r));
    }
  }

  const summary = {
    total: rows.length,
    paid: rows.filter(r => r.status === 'paid').length,
    pending: rows.filter(r => r.status === 'pending').length,
    overdue: rows.filter(r => r.status === 'overdue').length,
    totalAmount: rows.reduce((s, r) => s + r.amount, 0),
    paidAmount: rows.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0),
  };

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">月謝管理</h2>
        <button onClick={generateFees} disabled={generating}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
          {generating ? '生成中...' : `${month} 一括生成`}
        </button>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm">{message}</div>
      )}

      {/* フィルター */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">月</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">ステータス</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">全て</option>
            <option value="pending">未払い</option>
            <option value="paid">支払済</option>
            <option value="overdue">滞納</option>
            <option value="waived">免除</option>
          </select>
        </div>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: '合計', value: `¥${summary.totalAmount.toLocaleString()}`, sub: `${summary.total}件` },
          { label: '支払済', value: `¥${summary.paidAmount.toLocaleString()}`, sub: `${summary.paid}件`, color: 'text-emerald-700' },
          { label: '未払い・滞納', value: `${summary.pending + summary.overdue}件`, sub: `¥${(summary.totalAmount - summary.paidAmount).toLocaleString()}`, color: 'text-red-600' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color ?? 'text-gray-800'}`}>{card.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* 一覧 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-sm text-gray-400">読み込み中...</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-400">
            対象の月謝レコードがありません。「一括生成」ボタンで作成できます。
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-2.5 text-left text-xs text-gray-500">会員名</th>
                <th className="px-5 py-2.5 text-center text-xs text-gray-500">金額</th>
                <th className="px-5 py-2.5 text-center text-xs text-gray-500">ステータス</th>
                <th className="px-5 py-2.5 text-center text-xs text-gray-500">支払日</th>
                <th className="px-5 py-2.5 text-right text-xs text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(row => {
                const s = STATUS_LABELS[row.status];
                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-800">{row.memberName}</td>
                    <td className="px-5 py-3 text-center text-gray-700">¥{row.amount.toLocaleString()}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${s.color} ${s.bg}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center text-gray-500 text-xs">
                      {row.paidAt ? new Date(row.paidAt).toLocaleDateString('ja-JP') : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex gap-1.5 justify-end">
                        {row.status !== 'paid' && (
                          <button onClick={() => updateStatus(row.id, 'paid')}
                            className="text-xs text-emerald-600 hover:text-emerald-800 border border-emerald-200 px-2 py-1 rounded-lg">
                            支払済
                          </button>
                        )}
                        {row.status === 'pending' && (
                          <button onClick={() => updateStatus(row.id, 'overdue')}
                            className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-2 py-1 rounded-lg">
                            滞納
                          </button>
                        )}
                        {row.status !== 'waived' && row.status !== 'paid' && (
                          <button onClick={() => updateStatus(row.id, 'waived')}
                            className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-2 py-1 rounded-lg">
                            免除
                          </button>
                        )}
                        {row.status !== 'pending' && row.status !== 'paid' && (
                          <button onClick={() => updateStatus(row.id, 'pending')}
                            className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-2 py-1 rounded-lg">
                            戻す
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
