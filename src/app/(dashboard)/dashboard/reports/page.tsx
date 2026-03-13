'use client';
import { useState, useEffect } from 'react';

interface AttendanceRow {
  memberId: string;
  memberName: string;
  attended: number;
  slots: string[];
}
interface ReportData {
  from: string;
  to: string;
  rows: AttendanceRow[];
  summary: { totalSlots: number; totalAttendances: number; uniqueMembers: number };
  slots: { id: string; date: string; title: string; startTime: string }[];
}
interface Group { id: string; name: string; }

export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [groupId, setGroupId] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/groups').then(r => r.json()).then(d => { if (Array.isArray(d)) setGroups(d); });
    fetchReport();
  }, []);

  async function fetchReport() {
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    if (groupId) params.set('groupId', groupId);
    const res = await fetch(`/api/reports/attendance?${params}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  const attendanceRate = (data && data.summary.totalSlots > 0)
    ? ((data.summary.totalAttendances / (data.summary.totalSlots * Math.max(data.rows.length, 1))) * 100).toFixed(1)
    : null;

  return (
    <div className="p-8 max-w-4xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">出席レポート</h2>

      {/* フィルター */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">開始日</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">終了日</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">グループ</label>
            <select value={groupId} onChange={e => setGroupId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">全グループ</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <button onClick={fetchReport} disabled={loading}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
            {loading ? '集計中...' : '集計'}
          </button>
        </div>
      </div>

      {data && (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'レッスン数', value: data.summary.totalSlots, unit: '回', color: 'text-gray-800' },
              { label: '出席記録', value: data.summary.totalAttendances, unit: '件', color: 'text-emerald-700' },
              { label: '参加会員', value: data.summary.uniqueMembers, unit: '名', color: 'text-blue-700' },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-center">
                <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                <p className={`text-3xl font-bold ${card.color}`}>
                  {card.value}<span className="text-base font-normal text-gray-400 ml-1">{card.unit}</span>
                </p>
              </div>
            ))}
          </div>

          {/* 会員別出席表 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">会員別出席数</h3>
            </div>
            {data.rows.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-400">この期間の出席記録がありません</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-2.5 text-left text-xs text-gray-500">会員名</th>
                    <th className="px-5 py-2.5 text-center text-xs text-gray-500">出席数</th>
                    <th className="px-5 py-2.5 text-right text-xs text-gray-500">
                      出席率 <span className="text-gray-300">(/ {data.summary.totalSlots}回)</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.rows.map(row => {
                    const rate = data.summary.totalSlots > 0
                      ? Math.round((row.attended / data.summary.totalSlots) * 100)
                      : 0;
                    return (
                      <tr key={row.memberId} className="hover:bg-gray-50">
                        <td className="px-5 py-2.5 font-medium text-gray-800">{row.memberName}</td>
                        <td className="px-5 py-2.5 text-center text-gray-700">{row.attended}</td>
                        <td className="px-5 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 bg-gray-100 rounded-full h-1.5">
                              <div
                                className="bg-emerald-500 h-1.5 rounded-full"
                                style={{ width: `${Math.min(rate, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-8 text-right">{rate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
