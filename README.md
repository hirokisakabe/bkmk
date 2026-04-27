# bkmk

URL をフォルダで整理し、OGP プレビュー付きで管理できるブックマークマネージャー。Web UI と CLI の両方から同じデータを操作できます。

## コンセプト

ブラウザ標準のブックマークは「並び替えにくい」「検索が弱い」「複数デバイスで使いにくい」といった不満があります。bkmk は次のような体験を目指しています。

- **ビジュアルで分かるブックマーク** — URL を登録するだけで OGP からタイトル・説明・サムネイル・ファビコンを自動取得し、リンク先を開かずに内容を判別できます。
- **パスで整理する階層フォルダ** — `/work/dev` のようなパスでフォルダを構成し、ドラッグ＆ドロップで自由に並び替え・移動ができます。
- **どこからでも同じデータ** — Web UI で見やすく整理し、CLI でターミナルからサッと追加・検索する、といった使い分けができます。
- **消しても戻せる** — 削除はゴミ箱に移すだけ。気が変わっても復元できます。

## 主な機能

- URL を追加すると OGP メタデータ（タイトル / 説明 / 画像 / ファビコン）を自動取得
- YouTube は oEmbed API、Twitter / X は FxTwitter API で専用メタデータを取得
- パスベースのフォルダで階層管理、ドラッグ＆ドロップで並び替え・移動
- タイトル・URL・説明を対象にした全文検索
- ゴミ箱経由のソフトデリートと復元、完全削除
- メールアドレス + パスワードによるアカウント認証
- Web UI（React SPA）と CLI（`@bkmk/cli`）の 2 つのクライアント

## 使い方

### Web UI

セルフホストしたインスタンス（例: `http://localhost:8080`）にアクセスし、サインアップしてログインします。

- **ブックマークの追加**: 画面上部のフォームに URL を貼り付けて送信
- **フォルダ操作**: 左サイドバーのフォルダツリーから作成・リネーム・移動・削除
- **並び替え・移動**: ドラッグ＆ドロップでブックマーク／フォルダを並び替え、別フォルダへ移動
- **検索**: 検索バーにキーワードを入力（タイトル・URL・説明を横断）
- **ゴミ箱**: 削除したアイテムは `/trash` から復元または完全削除
- **設定**: `/settings` から表示設定の変更やアカウント削除

### CLI（`@bkmk/cli`）

ターミナルから素早くブックマーク操作を行えます。

```bash
npm install -g @bkmk/cli

bkmk login                              # サーバーにログイン（既定の接続先は公開ホスト）
bkmk add https://example.com -f /work   # /work フォルダに追加
bkmk ls /work                           # フォルダ内を一覧
bkmk search hono                        # キーワードで検索
bkmk mkdir /work/dev                    # フォルダ作成
bkmk mv <id> /work/dev                  # ブックマーク／フォルダを移動
bkmk open <id>                          # ブラウザで開く
bkmk rm <id>                            # ゴミ箱へ移動
bkmk trash                              # ゴミ箱を一覧
bkmk restore <id>                       # ゴミ箱から復元
bkmk rm <id> --force                    # 完全削除
```

`--json` オプションで機械可読な出力に切り替えられます。認証トークンは `~/.config/bkmk/session.json` に保存されます。

CLI は既定で公開ホスト環境に接続します。セルフホストしたインスタンスを利用する場合は、`bkmk login` の前に `~/.config/bkmk/config.json` を作成して接続先を上書きしてください。

```json
{ "apiUrl": "http://localhost:8080" }
```

## セルフホスト

Docker イメージから単一コンテナで起動できます。Neon などの PostgreSQL を `DATABASE_URL` に指定してください。

```bash
docker build -t bkmk .
docker run -p 8080:8080 \
  -e DATABASE_URL="postgresql://..." \
  -e BETTER_AUTH_SECRET="..." \
  -e BETTER_AUTH_URL="http://localhost:8080" \
  bkmk
```

## 開発者向け

セットアップ・アーキテクチャ・コマンド一覧は [AGENTS.md](./AGENTS.md) を参照してください。

## ライセンス

MIT
