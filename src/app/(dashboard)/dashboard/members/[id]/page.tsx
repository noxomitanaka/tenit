'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Member {
  id: string;
  name: string;
  nameKana: string | null;
  email: string | null;
  phone: string | null;
  level: string | null;
  status: string;
  notes: string | null;
}

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/members/${id}`)
      .then((r) => r.json())
      .then(setMember);
  }, [id]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const get = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement).value;

    const res = await fetch(`/api/members/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: get('name'), nameKana: get('nameKana'),
        email: get('email'), phone: get('phone'),
        level: get('level'), notes: get('notes'),
      }),
    });

    if (res.ok) {
      setMember(await res.json());
      setEditing(false);
    } else {
      setError((await res.json()).error ?? '更新に失敗しました');
    }
    setLoading(false);
  }

  async function handleDeactivate() {
    if (!confirm('この会員を退会にしますか？')) return;
    const res = await fetch(`/api/members/${id}`, { method: 'DELETE' });
    if (res.ok) router.push('/dashboard/members');
  }

  if (!member) return <div className="p-8 text-gray-400">読み込み中...</div>;

  return (
    <div className="p-8 max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/members" className="text-gray-400 hover:text-gray-600">←</Link>
        <h2 className="text-2xl font-bold text-gray-800">{member.name}</h2>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {editing ? (
          <form onSubmit={handleSave} className="space-y-4">
            {[
              { name: 'name', label: '氏名', required: true, defaultValue: member.name },
              { name: 'nameKana', label: 'フリガナ', defaultValue: member.nameKana ?? '' },
              { name: 'email', label: 'メール', type: 'email', defaultValue: member.email ?? '' },
              { name: 'phone', label: '電話', defaultValue: member.phone ?? '' },
              { name: 'notes', label: 'メモ', defaultValue: member.notes ?? '' },
            ].map((f) => (
              <div key={f.name}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                <input name={f.name} type={f.type ?? 'text'} required={f.required}
                  defaultValue={f.defaultValue}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">レベル</label>
              <select name="level" defaultValue={member.level ?? 'beginner'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="beginner">初級</option>
                <option value="intermediate">中級</option>
                <option value="advanced">上級</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={loading}
                className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                {loading ? '保存中...' : '保存'}
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
                キャンセル
              </button>
            </div>
          </form>
        ) : (
          <dl className="space-y-3">
            {[
              ['フリガナ', member.nameKana],
              ['メール', member.email],
              ['電話', member.phone],
              ['レベル', member.level === 'beginner' ? '初級' : member.level === 'intermediate' ? '中級' : '上級'],
              ['メモ', member.notes],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-4">
                <dt className="text-sm text-gray-500 w-24 shrink-0">{label}</dt>
                <dd className="text-sm text-gray-800">{value ?? '-'}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {!editing && (
        <div className="flex gap-3 mt-4">
          <button onClick={() => setEditing(true)}
            className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
            編集
          </button>
          <button onClick={handleDeactivate}
            className="flex-1 bg-white border border-red-200 text-red-600 py-2 rounded-lg text-sm hover:bg-red-50">
            退会処理
          </button>
        </div>
      )}
    </div>
  );
}
