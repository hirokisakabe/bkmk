import { createRoute, Link } from '@tanstack/react-router';

import {
  AuthShell,
  authPrimaryButtonClassName,
  authTextButtonClassName,
} from '../components/auth-shell';
import { rootRoute } from './__root';

interface VerifyEmailSearch {
  error?: string;
}

export const verifyEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/verify-email',
  validateSearch: (search: Record<string, unknown>): VerifyEmailSearch => ({
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { error } = verifyEmailRoute.useSearch();

  return (
    <AuthShell eyebrow="Email verification" title="メールアドレスの確認">
      {error ? (
        <div role="alert" className="space-y-5">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            この確認リンクは無効か、有効期限が切れています。ログインを試すと確認メールを再送できます。
          </div>
          <Link to="/login" search={{}} className={authTextButtonClassName}>
            ログイン画面で確認メールを再送する
          </Link>
        </div>
      ) : (
        <div role="status" className="space-y-5">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
            メールアドレスを確認しました。ログインして bkmk を利用できます。
          </div>
          <Link
            to="/login"
            search={{}}
            className={`${authPrimaryButtonClassName} block text-center`}
          >
            ログインする
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
