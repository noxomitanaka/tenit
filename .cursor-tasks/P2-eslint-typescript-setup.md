# P2: ESLint設定 + TypeScriptエラー解消

## 問題1: ESLint設定ファイルなし
ESLint 9がインストール済みだがflatconfig（`eslint.config.mjs`）が存在しない。`npm run lint` が実行不能。

### 修正方針
```javascript
// eslint.config.mjs
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];
```

## 問題2: TypeScriptコンパイルエラー（10件）
`npx tsc --noEmit` で10エラー。P1-security-criticalでstaff型は修正済みの前提で、残りを対応:

### 2a. seed.ts スキーマ不整合（3エラー）
`scripts/seed.ts` — `email` on clubSettings、`maxMembers` on groups、`dayOfWeek` on lessons が現行スキーマに存在しない。
→ seed.tsを現行スキーマに合わせて更新

### 2b. Buffer型エラー
`src/app/api/members/[id]/qr/route.ts:34` — `Buffer` が `BodyInit` に非互換。
→ `new Response(new Uint8Array(buffer), { headers: { 'Content-Type': 'image/png' } })`

### 2c. Drizzle returning()型エラー
`src/app/api/portal/profile/route.ts:35` — `.update().returning()` の型不整合。
→ `.set(updateData)` 後に別途 `.select()` で最新データ取得

## テスト要件
- `npx tsc --noEmit` エラーゼロ
- `npx eslint .` がパス
- `npm test` 全パス
