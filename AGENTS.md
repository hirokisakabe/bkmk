# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

# データベース（要 DATABASE_URL）
pnpm db:generate          # Drizzle マイグレーション生成
pnpm db:migrate           # マイグレーション適用
pnpm db:studio            # Drizzle Studio 起動
```

## CI

PR 作成時に knip → lint → format:check → typecheck → test が実行される。コミット前にこれらが通ることを確認すること。

## Architecture

pnpm モノレポ（Node.js 24+, TypeScript 6, ES modules）。

### パッケージ構成

- **`packages/api`** — Hono バックエンド。本番では `public/` 配下の SPA 静的ファイルも配信する。
- **`packages/web`** — React 19 + Vite フロントエンド。TanStack Router / React Query、Radix UI + TailwindCSS 4。

### バックエンド（@bkmk/api）

- **エントリポイント**: `src/index.ts` — Hono アプリ。`/auth/*` を better-auth に委譲し、`/api/*` に認証ミドルウェアを適用。`AppType` をエクスポートして Hono RPC の型共有に使用。
- **ルート**: `src/routes/` — bookmarks, folders, trash, search。各ルートは `Hono<Env>` 型で `c.get('user')` から認証ユーザーを取得。
- **バリデーション**: `@hono/zod-validator` + `src/validation-hook.ts` でリクエストを Zod スキーマで検証。
- **DB**: Drizzle ORM + Neon PostgreSQL。スキーマは `src/db/schema.ts`。
- **認証**: better-auth（email/password）。設定は `src/auth.ts`。

### フロントエンド（@bkmk/web）

- **ルーティング**: TanStack Router。`src/routes/` 配下に `index`（メイン）、`login`、`trash`。`__root.tsx` がレイアウト。
- **データ取得**: `src/hooks/` 配下のカスタムフック（use-bookmarks, use-folders 等）が React Query + Hono RPC 経由で API を呼ぶ。
- **API クライアント**: `src/lib/api-client.ts`。Hono RPC（`hono/client` の `hc`）を使用。API 側の `AppType` を参照して型安全にリクエストを送信。
- **認証ガード**: `src/lib/auth-guard.ts` + `src/lib/auth-client.ts`（better-auth クライアント）。

### データモデル

- **folders**: パスベースの階層構造（`path`, `parentPath`）。ユーザー+パスでユニーク。position による並び順。ソフトデリート。
- **bookmarks**: フォルダに属する（`folderPath`）。OGP メタデータ（title, description, imageUrl, faviconUrl）を保持。ユーザー+URL でユニーク。position による並び順。ソフトデリート。

### テスト

- **API テスト**: `vi.mock` で DB モジュール（`../db`）と OGP 取得をモック。`src/test/helpers.ts` の `createTestApp` で認証済みユーザーをセットした Hono アプリを作成し、`app.request()` でリクエスト。
- **Web テスト**: jsdom + Testing Library + MSW。`src/test/setup.ts` で MSW サーバー起動 & `auth-guard` をモック。ハンドラは `src/test/handlers.ts`。カスタムレンダラは `src/test/render.tsx`。

## Environment Variables

`.env.example` を参照。`DATABASE_URL`（Neon PostgreSQL）、`BETTER_AUTH_SECRET`、`BETTER_AUTH_URL` が必要。
