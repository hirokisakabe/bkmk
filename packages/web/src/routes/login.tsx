import { createRoute, useRouter } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';

import {
  AuthShell,
  authInputClassName,
  authPrimaryButtonClassName,
  authTextButtonClassName,
} from '../components/auth-shell';
import { authClient } from '../lib/auth-client';
import { requireGuest } from '../lib/auth-guard';
import { rootRoute } from './__root';

interface LoginSearch {
  mode?: 'signup';
}

interface VerificationNotice {
  message: string;
  title: string;
  tone: 'info' | 'warning';
}

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: requireGuest,
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    mode: search.mode === 'signup' ? ('signup' as const) : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const { mode: searchMode } = loginRoute.useSearch();
  const mode = searchMode === 'signup' ? 'signup' : 'login';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<VerificationNotice | null>(null);
  const [loading, setLoading] = useState(false);

  const requestVerificationEmail = async (): Promise<boolean> => {
    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: `${window.location.origin}/verify-email`,
      });
      return !result.error;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const result = await authClient.signIn.email({
          email,
          password,
          callbackURL: `${window.location.origin}/verify-email`,
        });
        if (result.error) {
          if (result.error.code === 'EMAIL_NOT_VERIFIED') {
            const delivered = await requestVerificationEmail();
            setNotice(
              delivered
                ? {
                    title: '確認メールをご確認ください',
                    tone: 'info',
                    message:
                      'メールアドレスの確認が必要です。確認メールを再送しました。届いたリンクを開いてから、もう一度ログインしてください。',
                  }
                : {
                    title: '確認メールを送信できませんでした',
                    tone: 'warning',
                    message:
                      'メールアドレスの確認が必要です。時間をおいてもう一度ログインし、確認メールの再送をお試しください。',
                  },
            );
          } else {
            setError('メールアドレスまたはパスワードを確認してください');
          }
          return;
        }
      } else {
        const result = await authClient.signUp.email({
          email,
          password,
          name: email,
          callbackURL: `${window.location.origin}/verify-email`,
        });
        if (result.error) {
          setError('アカウント作成に失敗しました。入力内容を確認してください');
          return;
        }
        const delivered = await requestVerificationEmail();
        setNotice(
          delivered
            ? {
                title: '確認メールをご確認ください',
                tone: 'info',
                message: `${email} のアカウント作成を受け付けました。確認メールが届いた場合は、メール内のリンクを開いてからログインしてください。`,
              }
            : {
                title: '確認メールを送信できませんでした',
                tone: 'warning',
                message:
                  'アカウント作成の手続きを受け付けましたが、確認メールの送信を完了できませんでした。ログイン画面に戻り、時間をおいて再送をお試しください。',
              },
        );
        return;
      }
      await router.navigate({ to: '/', search: {} });
    } catch {
      setError(mode === 'login' ? 'ログインに失敗しました' : 'アカウント作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell eyebrow={mode === 'login' ? 'Welcome back' : 'Create account'} title="bkmk">
      {notice ? (
        <div role="status" className="space-y-5">
          <div
            className={`rounded-xl border p-4 ${
              notice.tone === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-950'
                : 'border-blue-200 bg-blue-50 text-blue-950'
            }`}
          >
            <p className="font-semibold">{notice.title}</p>
            <p className="mt-1 text-sm leading-6">{notice.message}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              void router.navigate({ to: '/login', search: {} });
            }}
            className={authPrimaryButtonClassName}
          >
            ログイン画面へ戻る
          </button>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={authInputClassName}
                placeholder="mail@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={authInputClassName}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm leading-5 text-red-700">
                {error}
              </p>
            )}
            <button type="submit" disabled={loading} className={authPrimaryButtonClassName}>
              {loading ? '処理中...' : mode === 'login' ? 'ログイン' : 'アカウント作成'}
            </button>
          </form>
          {mode === 'login' && (
            <p className="mt-4 text-center text-sm">
              <button
                type="button"
                onClick={() => void router.navigate({ to: '/forgot-password' })}
                className={authTextButtonClassName}
              >
                パスワードを忘れた方
              </button>
            </p>
          )}
          <p className="mt-5 border-t border-slate-200 pt-5 text-center text-sm text-slate-600">
            {mode === 'login' ? (
              <>
                アカウントをお持ちでない方は
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    void router.navigate({ to: '/login', search: { mode: 'signup' } });
                  }}
                  className={authTextButtonClassName}
                >
                  こちら
                </button>
              </>
            ) : (
              <>
                アカウントをお持ちの方は
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    void router.navigate({ to: '/login', search: {} });
                  }}
                  className={authTextButtonClassName}
                >
                  こちら
                </button>
              </>
            )}
          </p>
        </>
      )}
    </AuthShell>
  );
}
