'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/portal', label: 'ホーム', exact: true },
  { href: '/portal/reservations', label: '予約履歴', exact: false },
  { href: '/portal/book', label: 'レッスン予約', exact: false },
  { href: '/portal/fees', label: '月謝', exact: false },
  { href: '/portal/credits', label: '振替', exact: false },
  { href: '/portal/profile', label: 'プロフィール', exact: false },
];

export function PortalNav() {
  const pathname = usePathname();
  return (
    <nav className="max-w-3xl mx-auto px-4 flex gap-1">
      {TABS.map(t => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              active
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
