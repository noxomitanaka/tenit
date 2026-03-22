# P3: デッドコード削除 + パフォーマンス改善

## デッドコード

### 1. 未使用email関数
`src/lib/email.ts:32-38` — `reservationConfirmHtml()` と `substitutionCreditHtml()` がエクスポートされているが、どこからもインポートされていない。
→ 削除

### 2. 未使用import
- `src/app/api/fees/route.ts:8` — `import { lt } from 'drizzle-orm'` → 削除
- `src/app/api/broadcast/route.ts:8` — `import { inArray } from 'drizzle-orm'` → 削除

### 3. 未使用依存パッケージ
- `react-big-calendar` — package.jsonに記載あるが、コード内にimport箇所なし
→ `npm uninstall react-big-calendar @types/react-big-calendar`（型定義も含めて）

## パフォーマンス

### 4. メンバーインポートの逐次INSERT → バッチINSERT
`src/app/api/members/import/route.ts:131-135` — forループ内で1件ずつinsert。
→ `tx.insert(members).values(allValidMembers)` に変更

### 5. APIレスポンスのページネーション（設計のみ）
全listエンドポイントにページネーション対応を追加。
- クエリパラメータ: `?limit=50&offset=0`
- デフォルト: limit=50, 最大limit=200
- レスポンスに `{ data: [...], total: number, limit: number, offset: number }` 形式
- 対象: `/api/members`, `/api/reservations`, `/api/fees`, `/api/tournaments`, `/api/attendances`

**注意**: フロントエンド側の対応も必要（無限スクロール or ページネーションUI）。バックエンド側のみ先行実装し、フロントは別タスクで対応。

## テスト要件
- デッドコード削除後に `npm test` 全パス
- バッチINSERT: 100件のCSVインポートテストが正常完了すること
