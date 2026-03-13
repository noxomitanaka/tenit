# Tenit 🎾

**テニスクラブ・スクール管理OSS — 自己ホスト型**
Open-source tennis club management (self-hosted)

[![AGPL-3.0 License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org)

> スコラプラス¥13,200/月・hacomono¥35,000+/月の機能を、自分のサーバーで無料で動かす。

**🚧 開発中 (Phase 0) — MVP coming soon**

---

## 機能 (Features)

- **会員管理** — プロフィール・グループ・家族アカウント・QRコード出席確認
- **コートスケジュール・予約** — 週次カレンダー、定期レッスン一括登録
- **振替レッスン管理** — 欠席 → 振替可能枠自動表示・期限管理（日本固有の重要機能）
- **大会・イベント管理** — スイスドロー / トーナメント / リーグ戦（[tennis-match-maker](https://github.com/noxomitanaka/tennis-match-maker) 統合）
- **メール / LINE 通知** — 予約確認・振替リマインド・一斉配信

---

## クイックスタート (Quick Start)

### Vercel（推奨・無料）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/noxomitanaka/tenit&env=NEXTAUTH_SECRET&envDescription=openssl%20rand%20-base64%2032%20で生成)

### Docker Compose

```bash
git clone https://github.com/noxomitanaka/tenit
cd tenit
cp .env.example .env   # NEXTAUTH_SECRET を設定
docker-compose up -d
# → http://localhost:3000/setup でクラブ情報を設定
```

### ローカル開発

```bash
git clone https://github.com/noxomitanaka/tenit
cd tenit
npm install
cp .env.example .env.local   # NEXTAUTH_SECRET を設定
npm run db:migrate           # SQLite DBを初期化
npm run dev
# → http://localhost:3000
```

---

## 環境変数

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `NEXTAUTH_SECRET` | ✅ | `openssl rand -base64 32` で生成 |
| `NEXTAUTH_URL` | ✅ | アプリのURL（例: `https://your-club.vercel.app`） |
| `DATABASE_URL` | — | 省略時: SQLite自動使用。Turso/PostgreSQL指定も可 |
| `SMTP_HOST` | — | メール通知用SMTPサーバー |
| `LINE_CHANNEL_ACCESS_TOKEN` | — | LINE Messaging API（オプション） |

詳細は [.env.example](.env.example) を参照。

---

## 技術スタック (Tech Stack)

| 領域 | 技術 |
|------|------|
| フロントエンド | Next.js 15 App Router + React 19 |
| データベース | SQLite (デフォルト) / PostgreSQL (オプション) |
| ORM | Drizzle ORM |
| 認証 | NextAuth v5 (Auth.js) |
| スタイリング | Tailwind CSS 4 |
| デプロイ | Vercel / Docker |
| テスト | Vitest |

### データベースの選択

| 環境 | `DATABASE_URL` の設定 |
|------|----------------------|
| ローカル開発 | 省略（`file:./local.db` を自動使用） |
| Vercel本番 | `libsql://xxx.turso.io?authToken=...`（Turso無料枠で十分） |
| 自前VPS | `postgresql://user:pass@host/tenit` |

---

## 開発ロードマップ (Roadmap)

- [x] **Phase 0**: 基盤構築（DB・認証・初期セットアップ）
- [ ] **Phase 1**: MVP機能（会員管理・予約・振替・大会）
- [ ] **Phase 2**: LINE通知 + デモサイト公開

---

## 関連プロジェクト (Related)

- **[tennis-match-maker](https://github.com/noxomitanaka/tennis-match-maker)** — テニス大会管理スタンドアロンツール（スイスドロー・トーナメント・ラウンドロビン）。テニットの大会機能として統合予定。

---

## ライセンス (License)

[AGPL-3.0](LICENSE) © 2026 Nozomi Tanaka

> 自己ホストして自由に使えます。修正して配布する場合はソースコードの公開が必要です（AGPL条件）。
