'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const form = e.currentTarget;
    const get = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: get('name'),
        email: get('email'),
        password: get('password'),
        phone: get('phone'),
      }),
    });

    if (res.ok) {
      router.push('/login?registered=1');
    } else {
      setError((await res.json()).error ?? '登録に失敗しました');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎾</div>
          <h1 className="text-xl font-bold text-gray-800">会員登録</h1>
          <p className="text-gray-500 text-sm mt-1">アカウントを作成してポータルにアクセスできます</p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { name: 'name', label: '氏名', required: true, placeholder: '田中 花子' },
            { name: 'email', label: 'メールアドレス', required: true, type: 'email', placeholder: 'hanako@example.com' },
            { name: 'phone', label: '電話番号', placeholder: '090-1234-5678' },
            { name: 'password', label: 'パスワード（8文字以上）', required: true, type: 'password', placeholder: '••••••••' },
          ].map(f => (
            <div key={f.name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {f.label}{f.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <input name={f.name} type={f.type ?? 'text'} required={f.required}
                placeholder={f.placeholder}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          ))}

          <button type="submit" disabled={loading}
            className="w-full bg-emerald-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
            {loading ? '登録中...' : '登録する'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          すでにアカウントをお持ちの方は{' '}
          <Link href="/login" className="text-emerald-600 hover:underline">ログイン</Link>
        </p>
      </div>
    </div>
  );
}
