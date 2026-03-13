'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Tournament {
  id: string; name: string; type: string; status: string; date: string | null; rounds: number;
}
interface Entry { entry: { id: string; memberId: string; wins: number; losses: number; points: number }; memberName: string; }
interface Match {
  id: string; round: number;
  player1Id: string | null; player2Id: string | null;
  score1: string | null; score2: string | null; winnerId: string | null;
}
interface Member { id: string; name: string; }

const TYPE_LABELS: Record<string, string> = {
  swiss: 'スイスドロー', elimination: 'シングルエリミネーション', round_robin: 'ラウンドロビン',
};

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [addMemberId, setAddMemberId] = useState('');
  const [scoreInput, setScoreInput] = useState<{ matchId: string; score1: string; score2: string; winnerId: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(() => {
    fetch(`/api/tournaments/${id}`).then(r => r.json()).then(d => {
      if (d.tournament) {
        setTournament(d.tournament);
        setEntries(d.entries ?? []);
        setMatches(d.matches ?? []);
      }
    });
  }, [id]);

  useEffect(() => {
    refresh();
    fetch('/api/members').then(r => r.json()).then((d: { members: Member[] }) => {
      if (Array.isArray(d.members)) setAllMembers(d.members);
    });
  }, [refresh]);

  async function addEntry() {
    if (!addMemberId) return;
    setLoading(true);
    const res = await fetch(`/api/tournaments/${id}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: addMemberId }),
    });
    if (res.ok) { refresh(); setAddMemberId(''); }
    else setError((await res.json()).error ?? 'エラー');
    setLoading(false);
  }

  async function generateRound() {
    setLoading(true);
    const res = await fetch(`/api/tournaments/${id}/matches`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (res.ok) refresh();
    else setError((await res.json()).error ?? 'ラウンド生成エラー');
    setLoading(false);
  }

  async function submitScore() {
    if (!scoreInput) return;
    setLoading(true);
    const res = await fetch(`/api/tournaments/${id}/matches`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scoreInput),
    });
    if (res.ok) { refresh(); setScoreInput(null); }
    else setError((await res.json()).error ?? 'スコア入力エラー');
    setLoading(false);
  }

  const nameOf = (memberId: string | null) => {
    if (!memberId) return 'BYE';
    return entries.find(e => e.entry.memberId === memberId)?.memberName ?? allMembers.find(m => m.id === memberId)?.name ?? memberId;
  };

  const rounds = Array.from(new Set(matches.map(m => m.round))).sort((a, b) => a - b);

  if (!tournament) return <div className="p-8 text-gray-400">読み込み中...</div>;

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/dashboard/tournaments" className="text-gray-400 hover:text-gray-600">←</Link>
        <h2 className="text-2xl font-bold text-gray-800">{tournament.name}</h2>
        <span className="text-sm text-gray-400">{TYPE_LABELS[tournament.type]}</span>
      </div>
      {tournament.date && <p className="text-sm text-gray-500 ml-10 mb-6">{tournament.date}</p>}

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 参加者 */}
        <div>
          <h3 className="font-semibold text-gray-700 mb-3">参加者 ({entries.length}名)</h3>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {entries.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-2 text-left text-xs text-gray-500">名前</th>
                    <th className="px-4 py-2 text-center text-xs text-gray-500">W</th>
                    <th className="px-4 py-2 text-center text-xs text-gray-500">L</th>
                    <th className="px-4 py-2 text-center text-xs text-gray-500">PT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...entries].sort((a, b) => b.entry.points - a.entry.points).map(e => (
                    <tr key={e.entry.id}>
                      <td className="px-4 py-2 font-medium text-gray-800">{e.memberName}</td>
                      <td className="px-4 py-2 text-center text-gray-600">{e.entry.wins}</td>
                      <td className="px-4 py-2 text-center text-gray-600">{e.entry.losses}</td>
                      <td className="px-4 py-2 text-center font-semibold text-emerald-600">{e.entry.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tournament.status === 'draft' && (
              <div className="p-3 flex gap-2 border-t border-gray-50">
                <select value={addMemberId} onChange={e => setAddMemberId(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="">会員を選択</option>
                  {allMembers.filter(m => !entries.find(e => e.entry.memberId === m.id)).map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <button onClick={addEntry} disabled={loading || !addMemberId}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50">
                  追加
                </button>
              </div>
            )}
          </div>

          {tournament.status === 'draft' && entries.length >= 2 && (
            <button onClick={generateRound} disabled={loading}
              className="mt-3 w-full bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
              {tournament.type === 'round_robin' ? '対戦表を生成' : 'ラウンド1を生成'}
            </button>
          )}
          {tournament.status === 'active' && tournament.type === 'swiss' && (
            <button onClick={generateRound} disabled={loading}
              className="mt-3 w-full border border-emerald-600 text-emerald-600 py-2 rounded-lg text-sm font-medium hover:bg-emerald-50 disabled:opacity-50">
              次ラウンドを生成
            </button>
          )}
        </div>

        {/* 対戦表 */}
        <div>
          <h3 className="font-semibold text-gray-700 mb-3">対戦表</h3>
          {rounds.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100">
              <p className="text-gray-400 text-sm">ラウンドがまだありません</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rounds.map(round => (
                <div key={round} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
                    <p className="text-xs font-medium text-gray-600">第 {round} ラウンド</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {matches.filter(m => m.round === round).map(m => (
                      <div key={m.id} className="px-4 py-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className={`font-medium ${m.winnerId === m.player1Id ? 'text-emerald-600' : 'text-gray-700'}`}>
                            {nameOf(m.player1Id)}
                          </span>
                          <div className="text-center mx-2">
                            {m.winnerId ? (
                              <span className="text-xs text-gray-500">{m.score1} - {m.score2}</span>
                            ) : m.player2Id ? (
                              <button onClick={() => setScoreInput({ matchId: m.id, score1: '', score2: '', winnerId: '' })}
                                className="text-xs text-emerald-600 hover:underline">スコア入力</button>
                            ) : (
                              <span className="text-xs text-gray-400">BYE</span>
                            )}
                          </div>
                          <span className={`font-medium text-right ${m.winnerId === m.player2Id ? 'text-emerald-600' : 'text-gray-700'}`}>
                            {nameOf(m.player2Id)}
                          </span>
                        </div>
                        {/* スコア入力フォーム */}
                        {scoreInput?.matchId === m.id && (
                          <div className="mt-2 space-y-2 bg-gray-50 rounded-lg p-3">
                            <div className="flex gap-2 items-center text-xs">
                              <input value={scoreInput.score1} onChange={e => setScoreInput(s => s && { ...s, score1: e.target.value })}
                                placeholder={nameOf(m.player1Id)} className="flex-1 border rounded px-2 py-1 text-xs" />
                              <span>vs</span>
                              <input value={scoreInput.score2} onChange={e => setScoreInput(s => s && { ...s, score2: e.target.value })}
                                placeholder={nameOf(m.player2Id)} className="flex-1 border rounded px-2 py-1 text-xs" />
                            </div>
                            <select value={scoreInput.winnerId} onChange={e => setScoreInput(s => s && { ...s, winnerId: e.target.value })}
                              className="w-full border rounded px-2 py-1 text-xs">
                              <option value="">勝者を選択</option>
                              <option value={m.player1Id ?? ''}>{nameOf(m.player1Id)}</option>
                              {m.player2Id && <option value={m.player2Id}>{nameOf(m.player2Id)}</option>}
                            </select>
                            <div className="flex gap-2">
                              <button onClick={submitScore} disabled={loading || !scoreInput.winnerId}
                                className="flex-1 bg-emerald-600 text-white py-1 rounded text-xs hover:bg-emerald-700 disabled:opacity-50">
                                記録
                              </button>
                              <button onClick={() => setScoreInput(null)}
                                className="flex-1 border text-gray-500 py-1 rounded text-xs hover:bg-gray-50">
                                キャンセル
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
