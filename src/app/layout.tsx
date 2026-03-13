import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tenit — テニスクラブ管理',
  description: 'テニスクラブ・スクールの会員管理・コート予約・振替レッスン管理ツール',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
