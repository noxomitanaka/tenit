import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node', // API Routeはnode環境で
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    env: {
      DATABASE_URL: 'file::memory:?cache=shared',
      NEXTAUTH_SECRET: 'test-secret-vitest',
      NEXTAUTH_URL: 'http://localhost:3000',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
