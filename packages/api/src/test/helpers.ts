import { Hono } from 'hono';
import type { Env as HonoPinoEnv } from 'hono-pino';
import { PinoLogger } from 'hono-pino';
import pino from 'pino';

import type { auth } from '../auth.js';

type Env = HonoPinoEnv & {
  Variables: {
    user: typeof auth.$Infer.Session.user;
    session: typeof auth.$Infer.Session.session;
  };
};

export const TEST_USER = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  emailVerified: true,
  image: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
} as typeof auth.$Infer.Session.user;

const TEST_SESSION = {
  id: 'test-session-id',
  expiresAt: new Date('2099-01-01'),
  token: 'test-token',
  ipAddress: null,
  userAgent: null,
  userId: TEST_USER.id,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
} as typeof auth.$Infer.Session.session;

/**
 * テスト用の Hono アプリを作成する。
 * 認証ミドルウェアで固定ユーザーをセットし、指定のルートをマウントする。
 */
export function createTestApp(path: string, route: Hono<Env>): Hono<Env> {
  const app = new Hono<Env>();

  app.use('*', async (c, next) => {
    c.set('user', TEST_USER);
    c.set('session', TEST_SESSION);
    c.set('logger', new PinoLogger(pino({ level: 'silent' })));
    await next();
  });

  app.route(path, route);

  return app;
}

/**
 * Drizzle のクエリビルダーチェーンをモックするヘルパー。
 * db.select().from().where().orderBy().limit() 等のチェーンを模倣する。
 */
export function mockQueryChain(result: unknown[] = []) {
  const resolvedResult = Promise.resolve(result);
  const chain: Record<string, unknown> = {};

  const proxy = new Proxy(chain, {
    get(_target, prop) {
      if (prop === 'then') {
        return resolvedResult.then.bind(resolvedResult);
      }
      return () => proxy;
    },
  });

  return proxy;
}
