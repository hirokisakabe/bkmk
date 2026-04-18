# bkmk

URL をブックマークして OGP プレビュー付きで管理できるアプリ。

## 構成

| パッケージ     | 説明                         |
| -------------- | ---------------------------- |
| `packages/api` | Hono API サーバー + SPA 配信 |
| `packages/web` | React SPA (Vite)             |
| `packages/cli` | CLI ツール                   |

## セットアップ

```bash
pnpm install
```

## 開発

```bash
pnpm dev
```

API: http://localhost:3000 / Web: http://localhost:5173

## ビルド・チェック

```bash
pnpm build
pnpm knip
pnpm lint
pnpm format:check
```

## データベース

環境変数 `DATABASE_URL` に Neon の接続文字列を設定してください。

```bash
export DATABASE_URL="postgresql://..."
```

マイグレーションファイルの生成・適用:

```bash
pnpm db:generate   # スキーマからマイグレーション SQL を生成
pnpm db:migrate    # マイグレーションを実行
pnpm db:studio     # Drizzle Studio を起動
```

## Docker

```bash
docker build -t bkmk .
docker run -p 8080:8080 bkmk
```
