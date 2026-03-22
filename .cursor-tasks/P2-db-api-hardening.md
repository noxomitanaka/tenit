# P2: DB設計 + API品質強化

## 問題1: DBインデックス不足
以下の複合インデックスを追加（高頻度クエリパターン）:

```typescript
// schema.ts に追加
// lessonSlots
export const lessonSlotsLessonDateIdx = index('lesson_slots_lesson_date_idx')
  .on(lessonSlots.lessonId, lessonSlots.date);

// monthlyFees
export const monthlyFeesMemberMonthIdx = index('monthly_fees_member_month_idx')
  .on(monthlyFees.memberId, monthlyFees.month);

// substitutionCredits
export const subCreditsMemIdx = index('sub_credits_member_idx')
  .on(substitutionCredits.memberId);

// tournamentEntries
export const tournEntryTournMemIdx = index('tourn_entry_tourn_mem_idx')
  .on(tournamentEntries.tournamentId, tournamentEntries.memberId);

// attendances
export const attendSlotMemIdx = index('attend_slot_mem_idx')
  .on(attendances.lessonSlotId, attendances.memberId);
```

インデックス追加後 `npx drizzle-kit generate` でマイグレーション生成。

## 問題2: トーナメントスコア更新の非トランザクション
`src/app/api/tournaments/[id]/matches/route.ts:128-148` — match result + 2 entry updatesがトランザクション外。

### 修正
```typescript
await db.transaction(async (tx) => {
  await tx.update(tournamentMatches)...
  await tx.update(tournamentEntries)... // player1
  await tx.update(tournamentEntries)... // player2
});
```

## 問題3: Stripe redirect URL改ざん
`src/app/api/fees/[id]/checkout/route.ts:70-72` — クライアントが `successUrl` / `cancelUrl` を任意指定可能。

### 修正
`body.successUrl` / `body.cancelUrl` を無視し、サーバー側の設定値のみ使用:
```typescript
const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
success_url: `${baseUrl}/portal/fees?success=true`,
cancel_url: `${baseUrl}/portal/fees?canceled=true`,
```

## 問題4: レート制限なし
`/api/join` と `/api/auth/register` が無制限。

### 修正方針
Next.js App Routerにはexpress-rate-limitが使えないため、以下のいずれか:
- Option A: Cloudflare WAFルール（インフラ側。推奨）
- Option B: 簡易インメモリレートリミッター（Map + setInterval cleanup）を middleware.ts に追加
- `/api/join`, `/api/auth/register`, `/api/auth/callback` に適用。15分あたり10リクエスト

## 問題5: JSフィルタリング → DBクエリ化
### 5a. 出席レポート
`src/app/api/reports/attendance/route.ts:70` — JS側でmemberId絞り込み。
→ `inArray(attendances.memberId, targetMemberIds)` をWHERE句に追加

### 5b. ブロードキャスト
`src/app/api/broadcast/route.ts:37-47` — JS側でグループ絞り込み。
→ memberGroupsテーブルとJOINしてDB側でフィルタ

## テスト要件
- マイグレーション生成後に `npm test` 全パス
- トランザクション修正: 中断シナリオのテスト（モックでDB.update2回目を失敗させ、1回目もロールバックされることを確認）
- レート制限: 11回目のリクエストが429を返すことを確認
