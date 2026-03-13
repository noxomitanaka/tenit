import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// パスワードのハッシュ化は本番では bcrypt 等を使う
// Phase 0 では crypto.subtle (Web Crypto API) で簡易実装
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(hash).toString('hex');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const hashed = await hashPassword(password);
  return hashed === hash;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Phase 0: JWT-only（@auth/drizzle-adapter は Phase 1 で追加）
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'メールアドレス', type: 'email' },
        password: { label: 'パスワード', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email as string),
        });

        if (!user || !user.hashedPassword) return null;

        const valid = await verifyPassword(
          credentials.password as string,
          user.hashedPassword
        );

        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
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
});

export { hashPassword };
