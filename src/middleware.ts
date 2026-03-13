import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

// Edge Runtime 互換: DB を参照しない authConfig のみ使用
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  if (!isLoggedIn) {
    return Response.redirect(new URL('/login', req.url));
  }
});

export const config = {
  matcher: ['/dashboard/:path*', '/portal/:path*'],
};
