import { createRoute, useRouter } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';

import { authClient } from '../lib/auth-client';
import { requireGuest } from '../lib/auth-guard';
import { rootRoute } from './__root';

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: requireGuest,
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search.mode === 'signup' ? ('signup' as const) : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const { mode: initialMode } = loginRoute.useSearch();
  const [mode, setMode] = useState<'login' | 'signup'>(
    initialMode === 'signup' ? 'signup' : 'login',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) {
          setError(result.error.message ?? 'ログインに失敗しました');
          return;
        }
      } else {
        const result = await authClient.signUp.email({ email, password, name: email });
        if (result.error) {
          setError(result.error.message ?? 'アカウント作成に失敗しました');
          return;
        }
      }
      await router.navigate({ to: '/', search: {} });
    } catch {
      setError(mode === 'login' ? 'ログインに失敗しました' : 'アカウント作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="w-80">
        <h1 className="mb-6 text-2xl font-bold">bkmk</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              placeholder="mail@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '処理中...' : mode === 'login' ? 'ログイン' : 'アカウント作成'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          {mode === 'login' ? (
            <>
              アカウントをお持ちでない方は
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError('');
                }}
                className="text-blue-600 hover:underline"
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
                  setMode('login');
                  setError('');
                }}
                className="text-blue-600 hover:underline"
              >
                こちら
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
