/**
 * Edge Runtime 互換の NextAuth 設定
 * middleware.ts はこちらのみ参照する（@/db などの Node.js ネイティブモジュールを含まない）
 */
import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isDashboard = nextUrl.pathname.startsWith('/dashboard');
      if (isDashboard) return isLoggedIn;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.role) {
        session.user.role = token.role as 'admin' | 'coach' | 'member';
      }
      return session;
    },
  },
};
