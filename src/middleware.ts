import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

// Edge Runtime 互換: DB を参照しない authConfig のみ使用
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  if (!isLoggedIn) {
    return Response.redirect(new URL('/login', req.url));
  }
  // /dashboard 配下は管理者・コーチ専用。member は API の requireAdmin を
  // バイパスして Server Component が直接 db を叩くページに到達できるため、
  // ゲート層でロールを検査し member を /portal へ退避させる。
  const role = req.auth?.user?.role;
  if (req.nextUrl.pathname.startsWith('/dashboard') && role !== 'admin' && role !== 'coach') {
    return Response.redirect(new URL('/portal', req.url));
  }
});

export const config = {
  matcher: ['/dashboard/:path*', '/portal/:path*'],
};
