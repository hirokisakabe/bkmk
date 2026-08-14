# 認証メールのセットアップ

bkmk は新規登録時のメールアドレス確認とパスワード再設定に Resend を使用します。確認リンクと再設定リンクの有効期限は1時間です。

## Resend の準備

1. Resend で送信元ドメインを追加し、案内された DNS レコードを設定してドメインを確認します。
2. 送信権限だけを持つ API キーを発行します。
3. `.env.example` を `.env` へコピーし、次の値を設定します。

```dotenv
RESEND_API_KEY="re_..."
EMAIL_FROM_ADDRESS="noreply@確認済みドメイン"
EMAIL_FROM_NAME="bkmk"
```

`RESEND_API_KEY` は秘密値です。`.env`、ログ、issue、PR、ソースコードへ記録しないでください。`EMAIL_FROM_ADDRESS` のドメインは Resend で確認済みのドメインと一致させます。

ローカルで実際に登録・再設定メールを送るときだけ有効な Resend 設定が必要です。`pnpm test` と `pnpm --filter @bkmk/web test:e2e` は送信処理を差し替えるため、外部へメールを送りません。`pnpm db:seed` もメールを送らず、固定テストユーザーを確認済みとして作成します。

## Cloud Run の設定

本番・PR プレビューの workflow は Secret Manager の `resend-api-key` を `RESEND_API_KEY` としてコンテナへ渡します。デプロイ前に、対象 GCP project で secret と実行サービスアカウントからの参照権限を用意してください。秘密値自体を GitHub Actions の workflow へ記載する必要はありません。

送信元を変更する場合は `.github/workflows/cd.yml` と `.github/workflows/preview.yml` の `EMAIL_FROM_ADDRESS` を、確認済みドメインのアドレスへ変更します。

## 動作確認

- 新規登録後、ログイン状態にならず「確認メールをご確認ください」と表示される
- 未確認のままログインすると、確認メールが再送される
- 確認リンクを開いた後はログインできる
- ログイン画面の「パスワードを忘れた方」から再設定メールを要求できる
- 無効または期限切れのリンクでは、再送へ進める案内が表示される

参考: [Better Auth email/password](https://better-auth.com/docs/authentication/email-password)、[Better Auth options](https://better-auth.com/docs/reference/options)、[Resend Node.js quickstart](https://resend.com/docs/send-with-nodejs)
