# Tenit 🎾

**テニスクラブ・スクール管理OSS — 自己ホスト型**
Open-source tennis club management (self-hosted)

[![AGPL-3.0 License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org)

> スコラプラス¥13,200/月・hacomono¥35,000+/月の機能を、自分のサーバーで無料で動かす。

**🚧 開発中 (Phase 2) — 予約・振替・LINE通知**

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

## 本番環境 (Production — Cobe Associe)

### インフラ構成

```
Browser (HTTPS)
  └─ https://tenit.cobeassocie.com
       └─ Cloudflare CDN (TLS終端 + WAF)
            └─ Cloudflare Tunnel (mba-server)
                 └─ Mac mini localhost:8080 (Caddy reverse proxy)
                      └─ localhost:3005 (Next.js / PM2 id=5)
```

- **ホスト**: Mac mini (M4 Pro, 64GB, macOS)
- **プロセス管理**: PM2 (`pm2 start npm --name tenit -- run start -- -p 3005`)
- **リバースプロキシ**: Caddy (host matcher `tenit.cobeassocie.com` → `localhost:3005`)
- **DNS/CDN**: Cloudflare (CNAME → Cloudflare Tunnel)
- **DB**: SQLite (`file:./local.db`) — ローカルファイル

### ドメインマップ

| URL | 用途 | 対象ユーザー |
|-----|------|-------------|
| `https://tenit.cobeassocie.com/` | ランディングページ | 公開 |
| `https://tenit.cobeassocie.com/setup` | 初回セットアップ（管理者作成） | 1回のみ |
| `https://tenit.cobeassocie.com/login` | ログイン（全ロール共通） | 全ユーザー |
| `https://tenit.cobeassocie.com/register` | 会員セルフ登録 | 新規会員 |
| `https://tenit.cobeassocie.com/join` | 会員登録（別入口） | 新規会員 |
| `https://tenit.cobeassocie.com/dashboard/*` | 管理画面 | admin / coach / staff |
| `https://tenit.cobeassocie.com/portal/*` | 会員ポータル | member |

### ルート × ロール 詳細

```
/dashboard/                [認証必須] 管理画面
  ├─ /members              [admin]     会員管理（一覧・登録・編集・CSV入出力）
  ├─ /schedule             [coach+]    レッスン枠管理（生成・出欠）
  ├─ /reservations         [staff+]    予約管理
  ├─ /tournaments          [admin]     大会管理（トーナメント・結果入力）
  ├─ /fees                 [admin]     月謝管理（一括生成・Stripe決済）
  ├─ /broadcast            [admin]     一斉連絡（メール/LINE）
  ├─ /reports              [staff+]    レポート・出席分析
  └─ /settings             [admin]     クラブ設定（LINE/Stripe連携）

/portal/                   [認証必須] 会員ポータル
  ├─ /reservations         予約確認・キャンセル
  ├─ /book                 レッスン空き検索・予約
  ├─ /fees                 自分の月謝・支払い状況
  ├─ /credits              振替レッスンクレジット
  └─ /profile              プロフィール編集
```

### ロール権限マトリクス

| 機能 | admin | coach | staff | member |
|------|:-----:|:-----:|:-----:|:------:|
| Dashboard アクセス | o | o | o | - |
| Portal アクセス | - | - | - | o |
| 会員CRUD | o | - | - | - |
| レッスン枠管理 | o | o | - | - |
| 予約管理 | o | - | o | - |
| 大会管理 | o | - | - | - |
| 月謝管理 | o | - | - | - |
| 一斉連絡 | o | - | - | - |
| レポート閲覧 | o | - | o | - |
| クラブ設定 | o | - | - | - |
| 自分の予約・支払い | - | - | - | o |

### 同一サーバー上の他アプリ

| URL | アプリ | Port |
|-----|--------|------|
| https://tenit.cobeassocie.com | Tenit | 3005 |
| https://gijiroku.cobeassocie.com | Gijiroku（議事録） | 3004 |
| https://tennis.cobeassocie.com | Tennis Match Maker | 3001 |
| https://debate.cobeassocie.com | Debate Webapp | 3003 |
| https://persona.cobeassocie.com | Persona Survey | 3002 |
| https://dashboard.cobeassocie.com | CC Dashboard | 18800 |

### 運用コマンド

```bash
# PM2
pm2 list                          # 全アプリ状態確認
pm2 logs tenit --lines 20         # ログ確認
pm2 restart tenit                 # 再起動

# DB
cd ~/cc-pjt/apps/tenit
npx drizzle-kit migrate           # マイグレーション実行
npx drizzle-kit studio            # DB GUI (localhost:4983)
npx tsx scripts/seed.ts           # シードデータ投入

# Caddy
caddy validate --config ~/Caddyfile
caddy reload --config ~/Caddyfile

# Cloudflare Tunnel
cloudflared tunnel route dns mba-server <subdomain>.cobeassocie.com
```

---

## 開発ロードマップ (Roadmap)

- [x] **Phase 0**: 基盤構築（DB・認証・初期セットアップ）
- [x] **Phase 1**: MVP機能（会員管理・スケジュール・予約・振替API・入会申請フォーム）
- [x] **Phase 2**: 予約管理UI・振替クレジットUI・LINE通知・クラブ設定
- [ ] **Phase 3**: 会員ポータル・大会管理・QR出席確認

---

## 関連プロジェクト (Related)

- **[tennis-match-maker](https://github.com/noxomitanaka/tennis-match-maker)** — テニス大会管理スタンドアロンツール（スイスドロー・トーナメント・ラウンドロビン）。テニットの大会機能として統合予定。

---

## ライセンス (License)

[AGPL-3.0](LICENSE) © 2026 Nozomi Tanaka

> 自己ホストして自由に使えます。修正して配布する場合はソースコードの公開が必要です（AGPL条件）。
