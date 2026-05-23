# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## ローカル開発セットアップ

初回または DB を作り直したいときの手順。Docker（OrbStack 等）が必要。

```bash
cp .env.example .env       # ローカル既定値の DATABASE_URL / BETTER_AUTH_SECRET が入っている
docker compose up -d db    # Postgres 17 を 5432 で起動（healthcheck 完了まで数秒）
pnpm install
pnpm db:migrate            # スキーマ適用
pnpm db:seed               # 固定テストユーザー + サンプル folders/bookmarks を投入（冪等）
pnpm dev                   # API (3000) + Web (5173) を起動
```

テストユーザー: `test@example.com` / `password1234`。Web 画面のログインフォームから入れる。

`pnpm db:seed` はテストユーザー自体を delete cascade で消してから作り直し、サンプル folders/bookmarks を transaction で投入する。UI で手動追加したデータも毎回消えるので注意。`DATABASE_URL` が `localhost` 以外を指している場合は安全のため停止する（必要なら `BKMK_SEED_ALLOW_REMOTE=1` で bypass 可）。

## Commands

```bash
# 開発
pnpm dev                  # API + Web を同時起動（concurrently）

# ビルド・チェック
pnpm build                # 全パッケージビルド
pnpm lint                 # ESLint
pnpm lint:fix             # ESLint 自動修正
pnpm format:check         # Prettier チェック
pnpm format               # Prettier 自動整形
pnpm typecheck            # 全パッケージ tsc --noEmit
pnpm knip                 # 未使用コード・依存の検出（Knip）

# テスト
pnpm test                 # 全パッケージテスト実行
pnpm --filter @bkmk/api test             # API テストのみ
pnpm --filter @bkmk/web test             # Web テストのみ
npx vitest run src/routes/folders.test.ts # 単一ファイル（パッケージ内で実行）
pnpm --filter @bkmk/web test:e2e         # E2E テスト（Playwright / Chromium）

# データベース（要 DATABASE_URL）
pnpm db:generate          # Drizzle マイグレーション生成
pnpm db:migrate           # マイグレーション適用
pnpm db:seed              # 固定テストユーザー + サンプル folders/bookmarks を投入
pnpm db:studio            # Drizzle Studio 起動
```

## CI

PR 作成時に knip → lint → format:check → typecheck → test → e2e（Playwright）が実行される。加えて Docker ビルドテストも別ジョブで実行される。コミット前にこれらが通ることを確認すること。

## Changesets

`packages/cli` に変更がある場合は `pnpm changeset add` で changeset を追加すること。main マージ後に Version PR が自動作成され、そのマージで npm publish が実行される。

## Architecture

pnpm モノレポ（Node.js 24+, TypeScript 6, ES modules）。

### パッケージ構成

- **`packages/api`** — Hono バックエンド。本番では `public/` 配下の SPA 静的ファイルも配信する。
- **`packages/cli`** — CLI ツール。Commander.js + Hono RPC クライアント。npm に `@bkmk/cli` として公開。
- **`packages/web`** — React 19 + Vite フロントエンド。TanStack Router / React Query、Radix UI + TailwindCSS 4。

### バックエンド（@bkmk/api）

- **エントリポイント**: `src/index.ts` — Hono アプリ。`/auth/*` を better-auth に委譲し、`/api/*` に認証ミドルウェアを適用。`AppType` をエクスポートして Hono RPC の型共有に使用。
- **ルート**: `src/routes/` — bookmarks, folders, trash, search, user。各ルートは `Hono<Env>` 型で `c.get('user')` から認証ユーザーを取得。
- **バリデーション**: `@hono/zod-validator` + `src/validation-hook.ts` でリクエストを Zod スキーマで検証。
- **DB**: Drizzle ORM + PostgreSQL (`pg` driver)。ローカルは docker-compose の Postgres、本番は Neon の pooled エンドポイント。スキーマは `src/db/schema.ts`。
- **認証**: better-auth（email/password + bearer token プラグイン）。設定は `src/auth.ts`。
- **OGP 取得**: `src/ogp.ts` — URL からメタデータ（title, description, image, favicon）を抽出。localhost・プライベート IP を拒否、HTML サイズ上限 512KB。YouTube は oEmbed API、Twitter/X は FxTwitter API で専用取得。
- **Hono RPC 型共有**: `src/index.ts` でルートをチェーンして `AppType` をエクスポート。Web・CLI パッケージがこの型を参照して型安全な API クライアントを構築。

### フロントエンド（@bkmk/web）

- **ルーティング**: TanStack Router。`src/routes/` 配下に `index`（メイン）、`login`、`settings`、`trash`。`__root.tsx` がレイアウト。
- **データ取得**: `src/hooks/` 配下のカスタムフック（use-bookmarks, use-folders 等）が React Query + Hono RPC 経由で API を呼ぶ。
- **API クライアント**: `src/lib/api-client.ts`。Hono RPC（`hono/client` の `hc`）を使用。API 側の `AppType` を参照して型安全にリクエストを送信。
- **認証ガード**: `src/lib/auth-guard.ts` + `src/lib/auth-client.ts`（better-auth クライアント）。
- **設定ストア**: `src/lib/settings-store.ts`。IndexedDB でユーザー設定を永続化。`useSettings` フックで読み書き。
- **コンポーネント**: `src/components/` — layout, folder-tree, bookmark-list, search-results, add-bookmark-form, folder-dialogs。
- **DnD 方針**: DnD の操作範囲・feedback・handle 表示・テスト方針を変更する場合は `docs/dnd.md` を確認し、必要に応じて更新する。

### CLI（@bkmk/cli）

- **エントリポイント**: `src/index.ts` — Commander.js プログラム。`bkmk` コマンドとして実行。
- **コマンド**: login, add, ls, search, mkdir, mv, rm, trash, restore, open。
- **API クライアント**: `src/client.ts` — Hono RPC クライアント。`~/.config/bkmk/session.json` の bearer token で認証。
- **設定**: `src/config.ts` — `~/.config/bkmk/` にトークンと設定を永続化。

### データモデル

- **folders**: パスベースの階層構造（`path`, `parentPath`）。ユーザー+パスでユニーク。position による並び順。ソフトデリート。
- **bookmarks**: フォルダに属する（`folderPath`）。OGP メタデータ（title, description, imageUrl, faviconUrl）を保持。ユーザー+URL でユニーク。position による並び順。ソフトデリート。

### API エンドポイント

- **`/api/bookmarks`**: GET（一覧）, POST（作成+OGP取得）, PATCH /:id（更新）, PATCH /:id/position（並び替え）, DELETE /:id（ソフトデリート）
- **`/api/folders`**: GET（一覧）, POST（作成）, PATCH /:id（リネーム/移動）, PATCH /:id/position（並び替え）, DELETE /:id（ソフトデリート）
- **`/api/search`**: GET（全文検索、クエリ `q`）
- **`/api/trash`**: GET（一覧）, POST /:id/restore（復元）, DELETE /:id（完全削除）, DELETE /（全削除）
- **`/api/user`**: DELETE /（アカウント削除）
- **`/auth/*`**: better-auth に委譲（sign-in, sign-up, sign-out, get-session）
- **`/health`**: ヘルスチェック

### テスト

- **API テスト**: `vi.mock` で DB モジュール（`../db`）と OGP 取得をモック。`src/test/helpers.ts` の `createTestApp` で認証済みユーザーをセットした Hono アプリを作成し、`app.request()` でリクエスト。
- **Web テスト**: jsdom + Testing Library + MSW。`src/test/setup.ts` で MSW サーバー起動 & `auth-guard` をモック。ハンドラは `src/test/handlers.ts`。カスタムレンダラは `src/test/render.tsx`。
- **CLI テスト**: Vitest。コマンドごとにテストファイルあり（`src/commands/*.test.ts`）。

## Environment Variables

`.env.example` を参照。`DATABASE_URL`（PostgreSQL）、`BETTER_AUTH_SECRET`、`BETTER_AUTH_URL` が必要。`.env.example` はローカル docker-compose 既定値を持つ。

## 開発環境

- 開発時は `pnpm dev` で API（port 3000）と Web（Vite dev server）が同時起動する。
- Vite が `/api`、`/auth`、`/health` を `http://localhost:3000` にプロキシするため、CORS 設定不要。
- DB はローカル Postgres（`docker compose up -d db`）が前提。詳細は冒頭「ローカル開発セットアップ」を参照。

## デプロイ

- **Docker**: マルチステージビルド（`Dockerfile`）。Web をビルドし API の `public/` にコピーして単一コンテナで配信。
- **本番ポート**: 8080（`PORT` 環境変数で変更可）。
- **SPA ルーティング**: API が `public/index.html` へフォールバック配信。

### PR プレビュー環境

PR を作成すると `.github/workflows/preview.yml` が起動し、PR ごとに独立した環境を立ち上げる。

- **Cloud Run service**: `bkmk-pr-<PR#>` という名前で deploy。close 時に削除される。
- **Neon branch**: `pr-<PR#>` を main から copy-on-write で作成し、その DB に対して migration を実行。close 時に削除。
- **PR コメント**: deploy 完了後にプレビュー URL を PR コメントとして投稿（再 push 時は既存コメントを update）。
- **除外条件**: fork PR / dependabot PR は secrets 流出防止のため skip。
- **必要な GitHub Secrets**: 既存の `GCP_PROJECT_ID` / `GCP_WORKLOAD_IDENTITY_PROVIDER` / `GCP_SERVICE_ACCOUNT` / `BETTER_AUTH_SECRET` に加えて、`GCP_PROJECT_NUMBER`（preview URL 計算用）、`NEON_API_KEY`、`NEON_PROJECT_ID`（neonctl 用）が必要。
