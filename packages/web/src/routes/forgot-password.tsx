import { createRoute, Link } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';

import {
  AuthShell,
  authInputClassName,
  authPrimaryButtonClassName,
  authTextButtonClassName,
} from '../components/auth-shell';
import { authClient } from '../lib/auth-client';
import { rootRoute } from './__root';

export const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // アカウントの登録有無や配送結果をレスポンス差から推測させない。
    } finally {
      setSent(true);
      setLoading(false);
    }
  };

  return (
    <AuthShell eyebrow="Account recovery" title="パスワードを再設定">
      {sent ? (
        <div role="status" className="space-y-5">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
            安全のため、アカウントの登録状況やメールの配送結果は表示しません。再設定メールが届いた場合は、メール内のリンクを開いてください。
          </div>
          <p className="text-sm leading-6 text-slate-600">
            メールが届かない場合は迷惑メールフォルダを確認し、時間をおいてもう一度お試しください。
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm leading-6 text-slate-600">
            登録したメールアドレスを入力してください。再設定用リンクの有効期限は1時間です。
          </p>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={authInputClassName}
              autoComplete="email"
            />
          </div>
          <button type="submit" disabled={loading} className={authPrimaryButtonClassName}>
            {loading ? '送信中...' : '再設定メールを送る'}
          </button>
        </form>
      )}
      <p className="mt-6 border-t border-slate-200 pt-5 text-center text-sm">
        <Link to="/login" search={{}} className={authTextButtonClassName}>
          ログイン画面へ戻る
        </Link>
      </p>
    </AuthShell>
  );
}
