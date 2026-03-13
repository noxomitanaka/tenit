'use client';
import { useState } from 'react';

export default function JoinPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const form = e.currentTarget;
    const get = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement).value;

    const res = await fetch('/api/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: get('name'),
        nameKana: get('nameKana'),
        email: get('email'),
        phone: get('phone'),
        level: get('level'),
        message: get('message'),
      }),
    });

    if (res.ok) {
      setSubmitted(true);
    } else {
      setError((await res.json()).error ?? '送信に失敗しました');
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">🎾</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">申請を受け付けました</h1>
          <p className="text-gray-500 text-sm">
            管理者が確認後、メールにてご連絡いたします。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎾</div>
          <h1 className="text-xl font-bold text-gray-800">入会申請</h1>
          <p className="text-gray-500 text-sm mt-1">フォームに入力して送信してください</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { name: 'name', label: '氏名', required: true, placeholder: '田中 花子' },
            { name: 'nameKana', label: 'フリガナ', placeholder: 'タナカ ハナコ' },
            { name: 'email', label: 'メールアドレス', required: true, type: 'email', placeholder: 'hanako@example.com' },
            { name: 'phone', label: '電話番号', placeholder: '090-1234-5678' },
          ].map((f) => (
            <div key={f.name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {f.label}{f.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <input name={f.name} type={f.type ?? 'text'} required={f.required}
                placeholder={f.placeholder}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">レベル</label>
            <select name="level"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="beginner">初級（基礎から）</option>
              <option value="intermediate">中級</option>
              <option value="advanced">上級</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メッセージ（任意）</label>
            <textarea name="message" rows={3} placeholder="ご質問・ご要望があればお書きください"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-emerald-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
            {loading ? '送信中...' : '入会申請を送信'}
          </button>
        </form>
      </div>
    </div>
  );
}
