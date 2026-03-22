# P1(CRITICAL): セキュリティ脆弱性5件の修正

## 問題1: NextAuth型定義のstaff欠落 → 認可死コード
`src/types/next-auth.d.ts:7` — roleの型定義に `'staff'` がない。DBスキーマでは4値（admin/coach/staff/member）。
結果: `src/lib/api-auth.ts:58` の `requireStaff()` で `role !== 'staff'` がTypeScript上で常にtrue扱い（dead code）。

### 修正
```typescript
// src/types/next-auth.d.ts
role: 'admin' | 'coach' | 'staff' | 'member'
```

## 問題2: LINE webhook認証なし紐付け
`src/app/api/line/webhook/route.ts:44-49` — LINE上で `link <memberId>` と送るだけで任意のメンバーとLINEアカウントを紐付けできる。memberIdを知る攻撃者がLINE通知を乗っ取り可能。

### 修正方針
1. `/api/members/[id]/line-link` エンドポイントを新設。6桁PINを生成しDBに保存（有効期限5分）
2. 管理画面のメンバー詳細に「LINE連携PIN発行」ボタンを追加
3. LINE webhook側で `link <PIN>` を受け取り、PINでメンバーを特定して紐付け
4. PINは1回使用で無効化

## 問題3: Stripe秘密鍵のGETレスポンス漏洩
`src/app/api/settings/route.ts:15` — GETレスポンスから `lineChannelSecret` は除外しているが、`stripeSecretKey` と `stripeWebhookSecret` が含まれている。

### 修正
```typescript
const { stripeSecretKey, stripeWebhookSecret, lineChannelSecret, ...safeSettings } = settings;
return NextResponse.json(safeSettings);
```

## 問題4: sendEmailのtext未対応 → 空メール
`src/app/api/broadcast/route.ts:77` と `src/app/api/notifications/reminder/route.ts:60` — `sendEmail({ text: ... })` で呼ぶが、`SendEmailParams` インターフェースに `text` がない。

### 修正
`src/lib/email.ts` の `SendEmailParams` に `text?: string` を追加。`sendEmail` 内で `text` フォールバック対応:
```typescript
const mailOptions = {
  ...,
  html: params.html || undefined,
  text: params.text || undefined,
};
```

## 問題5: ポータル予約のクレジット消費が非トランザクション
`src/app/api/portal/reservations/route.ts:86-98` — 予約作成トランザクションの外でクレジット消費が実行される。障害時にデータ不整合。

### 修正
クレジット消費ロジックをトランザクション内（L36-83の `db.transaction()` ブロック内）に移動。管理者版 `/api/reservations/route.ts` の実装を参考に。

## テスト要件
- 問題1: `npx tsc --noEmit` がエラーゼロで通ること
- 問題2: LINE webhook テストに「PINなしのlink要求が拒否されること」を追加
- 問題3: GET /api/settings のレスポンスに stripeSecretKey が含まれないことをテスト
- 問題4: broadcast送信テストでメール本文が空でないことを確認
- 問題5: ポータル予約テストにクレジット消費のアトミック性テスト追加
