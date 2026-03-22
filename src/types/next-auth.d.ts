import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      role: 'admin' | 'coach' | 'staff' | 'member';
    } & DefaultSession['user'];
  }

  interface User {
    role: 'admin' | 'coach' | 'staff' | 'member';
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    role?: 'admin' | 'coach' | 'staff' | 'member';
  }
}
