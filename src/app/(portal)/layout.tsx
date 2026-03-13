import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PortalNav } from '@/components/portal-nav';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/portal" className="flex items-center gap-2">
            <span className="text-xl">🎾</span>
            <span className="font-bold text-emerald-700">Tenit</span>
            <span className="text-xs text-gray-400 ml-1">会員ポータル</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{session.user.name ?? session.user.email}</span>
            <form action="/api/auth/signout" method="POST">
              <button type="submit" className="text-xs text-gray-400 hover:text-gray-600">ログアウト</button>
            </form>
          </div>
        </div>
        <PortalNav />
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
