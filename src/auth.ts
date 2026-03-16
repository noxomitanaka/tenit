import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword, hashPassword, isLegacyHash } from '@/lib/password';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
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

        // SHA-256 旧ハッシュを bcrypt に自動マイグレーション
        if (isLegacyHash(user.hashedPassword)) {
          const newHash = await hashPassword(credentials.password as string);
          await db.update(users)
            .set({ hashedPassword: newHash })
            .where(eq(users.id, user.id));
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});
