import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar name={session.user.name} role={session.user.role} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
