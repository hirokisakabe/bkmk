import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

const app = new Hono();

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// SPA 静的配信（本番時）
app.use('/*', serveStatic({ root: './public' }));
app.get('/*', serveStatic({ path: './public/index.html' }));

const port = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port }, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
