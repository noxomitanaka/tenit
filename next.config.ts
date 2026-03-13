import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@libsql/client', 'qrcode'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // @libsql/client を CJS external として明示 → require() 経由で lib-cjs/node.js が使われ
      // file: URL (ローカルSQLite) をサポートする
      const originalExternals = config.externals;
      config.externals = [
        ...(Array.isArray(originalExternals) ? originalExternals : [originalExternals]),
        ({ request }: { request?: string }, callback: (err?: Error | null, result?: string) => void) => {
          if (request && (request === '@libsql/client' || request.startsWith('@libsql/'))) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
