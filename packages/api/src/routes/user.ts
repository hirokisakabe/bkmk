import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

import type { auth } from '../auth.js';
import { db } from '../db/index.js';
import { user } from '../db/schema.js';
import type { Env as HonoPinoEnv } from 'hono-pino';

type Env = HonoPinoEnv & {
  Variables: {
    user: typeof auth.$Infer.Session.user;
    session: typeof auth.$Infer.Session.session;
  };
};

export const userRoute = new Hono<Env>().delete('/', async (c) => {
  const currentUser = c.var.user;

  await db.delete(user).where(eq(user.id, currentUser.id));

  return c.json({ success: true });
});
