import { createRoute } from '@tanstack/react-router';

import { Layout } from '../components/layout';
import { requireAuth } from '../lib/auth-guard';
import { rootRoute } from './__root';

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: requireAuth,
  component: IndexPage,
});

function IndexPage() {
  return (
    <Layout>
      <p className="text-gray-500">メイン画面（実装は別issueで対応）</p>
    </Layout>
  );
}
