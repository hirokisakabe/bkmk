import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

import { auth } from './auth.js';
import { bookmarksRoute } from './routes/bookmarks.js';
import { foldersRoute } from './routes/folders.js';
import { searchRoute } from './routes/search.js';
import { trashRoute } from './routes/trash.js';
import { userRoute } from './routes/user.js';

const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// Auth routes
app.on(['POST', 'GET'], '/auth/*', (c) => {
  return auth.handler(c.req.raw);
});

// Auth middleware for API routes
app.use('/api/*', async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    c.set('user', null);
    c.set('session', null);
    return c.json({ error: 'Unauthorized' }, 401);
  }

  c.set('user', session.user);
  c.set('session', session.session);
  await next();
});

// API routes (chained for RPC type inference)
const routes = app
  .route('/api/folders', foldersRoute)
  .route('/api/bookmarks', bookmarksRoute)
  .route('/api/trash', trashRoute)
  .route('/api/search', searchRoute)
  .route('/api/user', userRoute);

export type AppType = typeof routes;

routes.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// SPA 静的配信（本番時）
routes.use('/*', serveStatic({ root: './public' }));
routes.get('/*', serveStatic({ path: './public/index.html' }));

const port = Number(process.env.PORT) || 3000;

serve({ fetch: routes.fetch, port }, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
