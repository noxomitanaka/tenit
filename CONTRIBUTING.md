# Contributing to Tenit

Tenit へのコントリビュートに興味を持っていただきありがとうございます。本ドキュメントは Issue / PR の出し方、開発環境のセットアップ、コーディング規約をまとめたものです。

日本語と English の併記でいずれの言語でも受け付けます。

---

## 行動規範

このプロジェクトには [Code of Conduct](./CODE_OF_CONDUCT.md) があります。参加者全員に遵守をお願いします。

## バグ報告 (Bug Reports)

GitHub Issues から `Bug report` テンプレートを選択して作成してください。再現手順・期待する動作・実際の動作・環境情報（OS / Node / DB）を含めてください。

## 機能リクエスト (Feature Requests)

GitHub Issues から `Feature request` テンプレートを使用してください。なぜその機能が必要か、誰が困っているのか、想定する代替案を書いてください。

セキュリティ脆弱性は Issue ではなく [SECURITY.md](./SECURITY.md) の手順に従ってください。

---

## 開発環境セットアップ

```bash
git clone https://github.com/noxomitanaka/tenit
cd tenit
npm install
cp .env.example .env.local
# NEXTAUTH_SECRET を openssl rand -base64 32 で生成して設定
npm run db:migrate
npm run db:seed   # (任意) サンプル管理者・データを投入
npm run dev
```

`http://localhost:3000/setup` でクラブ初期設定を行う（`db:seed` 済みならサンプル管理者でログイン可）。

### 必要な環境

- Node.js 20+
- npm 10+
- SQLite （`local.db` に自動作成）

### テスト

```bash
npm run lint        # ESLint
npm test            # Vitest (unit + integration)
npm run test:e2e    # Playwright E2E
npm run test:all    # 全部
```

---

## Pull Request の流れ

1. Issue を立てて方針を議論する（小修正は不要）
2. Fork してブランチを切る (`fix/xxx`, `feat/xxx`)
3. テストを追加・更新する
4. `npm run lint && npm test` がパスすることを確認
5. PR を出す。タイトルは Conventional Commits 形式 (`fix:`, `feat:`, `docs:` 等)

PR テンプレートに沿って、変更内容・テスト・スクリーンショット（UI変更時）を記載してください。

### コミットメッセージ

Conventional Commits に準拠します。

- `feat:` 機能追加
- `fix:` バグ修正
- `docs:` ドキュメント
- `test:` テスト追加・修正
- `refactor:` リファクタリング
- `chore:` ビルド・依存関係

---

## コーディング規約

- TypeScript strict mode
- ESLint / Prettier 設定に従う
- 1ファイル300行以内を目安にする
- API ルートはサーバ側で必ず認可チェック（フロント側ガードのみ禁止）
- DB アクセスは Drizzle ORM 経由。生 SQL は使わない
- ユーザー入力は必ずバリデーション（Zod 等）
- 秘密情報を絶対にコミットしない（`.env*` は gitignore 済み）

## ライセンス

Tenit は AGPL-3.0 ライセンスです。コントリビュートいただいたコードは同ライセンスで配布されることに同意したものとみなします。

商用ホスティング・SaaS 提供などで AGPL の派生作品公開義務が問題になる場合は、Issue で相談してください。
