import { createRoute } from '@tanstack/react-router';

import { Layout } from '../components/layout';
import { requireAuth } from '../lib/auth-guard';
import { rootRoute } from './__root';

export const trashRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trash',
  beforeLoad: requireAuth,
  component: TrashPage,
});

function TrashPage() {
  return (
    <Layout>
      <p className="text-gray-500">ゴミ箱画面（実装は別issueで対応）</p>
    </Layout>
  );
}
