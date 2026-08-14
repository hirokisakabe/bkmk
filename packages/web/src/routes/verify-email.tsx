import { createRoute, Link, redirect } from '@tanstack/react-router';

import { AuthShell, authTextButtonClassName } from '../components/auth-shell';
import { rootRoute } from './__root';

interface VerifyEmailSearch {
  error?: string;
}

export const verifyEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/verify-email',
  beforeLoad: ({ search }) => {
    if (!search.error) {
      // デプロイ前に発行済みの /verify-email callback でも成功案内を一本化する。
      throw redirect({ to: '/login', search: { verified: true } });
    }
  },
  validateSearch: (search: Record<string, unknown>): VerifyEmailSearch => ({
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  return (
    <AuthShell eyebrow="Email verification" title="メールアドレスの確認">
      <div role="alert" className="space-y-5">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          この確認リンクは無効か、有効期限が切れています。ログインを試すと確認メールを再送できます。
        </div>
        <Link to="/login" search={{}} className={authTextButtonClassName}>
          ログイン画面で確認メールを再送する
        </Link>
      </div>
    </AuthShell>
  );
}
