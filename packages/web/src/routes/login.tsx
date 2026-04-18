import { createRoute } from '@tanstack/react-router';

import { requireGuest } from '../lib/auth-guard';
import { rootRoute } from './__root';

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: requireGuest,
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="w-80">
        <h1 className="mb-6 text-2xl font-bold">bkmk</h1>
        <p className="text-gray-500">ログイン画面（実装は別issueで対応）</p>
      </div>
    </div>
  );
}
