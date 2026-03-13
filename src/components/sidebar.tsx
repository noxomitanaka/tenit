'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'ホーム', icon: '🏠', exact: true },
  { href: '/dashboard/members', label: '会員管理', icon: '👤', exact: false },
  { href: '/dashboard/schedule', label: 'スケジュール', icon: '📅', exact: false },
  { href: '/dashboard/reservations', label: '予約一覧', icon: '📋', exact: false },
  { href: '/dashboard/settings', label: '設定', icon: '⚙️', exact: false },
];

interface SidebarProps {
  name?: string | null;
  role?: string;
}

export function Sidebar({ name, role }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col h-screen shrink-0">
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎾</span>
          <span className="font-bold text-emerald-700 text-lg">Tenit</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-emerald-50 text-emerald-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-gray-100">
        <p className="text-xs font-medium text-gray-700 truncate">{name ?? '管理者'}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {role === 'admin' ? '管理者' : role === 'coach' ? 'コーチ' : '会員'}
        </p>
      </div>
    </aside>
  );
}
