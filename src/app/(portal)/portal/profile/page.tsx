'use client';
import { useState, useEffect } from 'react';

interface Profile {
  id: string;
  name: string;
  nameKana: string | null;
  email: string | null;
  phone: string | null;
  level: string;
}

const LEVEL_LABELS: Record<string, string> = {
  beginner: '初級', intermediate: '中級', advanced: '上級',
};

export default function PortalProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // QRコード URL (会員 ID を埋め込んだ QR 画像)
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/portal/profile').then(r => r.json()).then(d => {
      if (d.id) {
        setProfile(d);
        setQrUrl(`/api/members/${d.id}/qr`);
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    const form = e.currentTarget;
    const get = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;

    const res = await fetch('/api/portal/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: get('name'),
        nameKana: get('nameKana') || null,
        email: get('email') || null,
        phone: get('phone') || null,
      }),
    });

    if (res.ok) {
      setProfile(await res.json());
      setSaved(true);
      setEditing(false);
    } else {
      setError((await res.json()).error ?? '保存に失敗しました');
    }
    setSaving(false);
  }

  if (!profile) return <div className="p-4 text-gray-400 text-center">読み込み中...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-800">プロフィール</h1>

      {saved && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-700 text-sm">
          プロフィールを更新しました
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">{error}</div>
      )}

      {/* QRコード */}
      {qrUrl && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-center">
          <p className="text-xs text-gray-500 mb-3">出席確認用 QR コード</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="QR code" className="mx-auto w-36 h-36" />
          <a href={qrUrl} download={`qr-${profile.id}.png`}
            className="mt-3 inline-block text-xs text-emerald-600 hover:underline">
            ダウンロード
          </a>
        </div>
      )}

      {/* プロフィール */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        {!editing ? (
          <>
            <div className="space-y-3 text-sm">
              {[
                { label: '氏名', value: profile.name },
                { label: 'ふりがな', value: profile.nameKana ?? '—' },
                { label: 'メールアドレス', value: profile.email ?? '—' },
                { label: '電話番号', value: profile.phone ?? '—' },
                { label: 'レベル', value: LEVEL_LABELS[profile.level] ?? profile.level },
              ].map(row => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-gray-500">{row.label}</span>
                  <span className="font-medium text-gray-800">{row.value}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setEditing(true)}
              className="mt-5 w-full border border-emerald-600 text-emerald-600 py-2 rounded-lg text-sm font-medium hover:bg-emerald-50">
              編集する
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: '氏名', name: 'name', required: true, defaultValue: profile.name },
              { label: 'ふりがな', name: 'nameKana', required: false, defaultValue: profile.nameKana ?? '' },
              { label: 'メールアドレス', name: 'email', required: false, type: 'email', defaultValue: profile.email ?? '' },
              { label: '電話番号', name: 'phone', required: false, type: 'tel', defaultValue: profile.phone ?? '' },
            ].map(field => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                <input
                  name={field.name}
                  type={(field as { type?: string }).type ?? 'text'}
                  required={field.required}
                  defaultValue={field.defaultValue}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                {saving ? '保存中...' : '保存する'}
              </button>
              <button type="button" onClick={() => { setEditing(false); setError(''); }}
                className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">
                キャンセル
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
