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
pnpm lint
pnpm format:check
```

## Docker

```bash
docker build -t bkmk .
docker run -p 8080:8080 bkmk
```
