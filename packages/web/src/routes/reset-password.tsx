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

interface ResetPasswordSearch {
  error?: string;
  token?: string;
}

export const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  validateSearch: (search: Record<string, unknown>): ResetPasswordSearch => ({
    error: typeof search.error === 'string' ? search.error : undefined,
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { error: linkError, token } = resetPasswordRoute.useSearch();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);

  const invalidLink = Boolean(linkError || !token);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (password !== confirmation) {
      setError('確認用パスワードが一致しません');
      return;
    }
    setLoading(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setError('リンクが無効か期限切れです。再設定メールをもう一度送ってください');
        return;
      }
      setComplete(true);
    } catch {
      setError('パスワードを変更できませんでした。再設定メールをもう一度送ってください');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell eyebrow="Choose a new key" title="新しいパスワード">
      {invalidLink ? (
        <InvalidResetLink />
      ) : complete ? (
        <div role="status" className="space-y-5">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
            パスワードを変更しました。新しいパスワードでログインできます。
          </div>
          <Link
            to="/login"
            search={{}}
            className={`${authPrimaryButtonClassName} block text-center`}
          >
            ログインする
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-slate-700">
              新しいパスワード
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={authInputClassName}
            />
          </div>
          <div>
            <label
              htmlFor="password-confirmation"
              className="block text-sm font-medium text-slate-700"
            >
              新しいパスワード（確認）
            </label>
            <input
              id="password-confirmation"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className={authInputClassName}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm leading-5 text-red-700">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} className={authPrimaryButtonClassName}>
            {loading ? '変更中...' : 'パスワードを変更'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

function InvalidResetLink() {
  return (
    <div role="alert" className="space-y-5">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        この再設定リンクは無効か、有効期限が切れています。新しい再設定メールを送ってください。
      </div>
      <Link to="/forgot-password" className={authTextButtonClassName}>
        再設定メールをもう一度送る
      </Link>
    </div>
  );
}
