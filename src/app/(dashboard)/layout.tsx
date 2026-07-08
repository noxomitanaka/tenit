import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  // ダッシュボードは管理者・コーチ専用。Server Component が直接 db を叩くため、
  // middleware に加えてサーバー側でもロールを検査する（多層防御）。
  if (session.user.role !== 'admin' && session.user.role !== 'coach') redirect('/portal');

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar name={session.user.name} role={session.user.role} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
