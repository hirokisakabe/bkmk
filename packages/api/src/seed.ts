import { eq } from 'drizzle-orm';

import { auth } from './auth.js';
import { db } from './db/index.js';
import { bookmarks, folders, user } from './db/schema.js';

const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password1234';
const TEST_NAME = 'Test User';

function assertLocalDatabase(): void {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('DATABASE_URL is not set');
  }
  const host = new URL(raw).hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (!isLocal && process.env.BKMK_SEED_ALLOW_REMOTE !== '1') {
    throw new Error(
      `refusing to seed non-local database (host="${host}"). ` +
        `pnpm db:seed is intended for local Postgres only. ` +
        `set BKMK_SEED_ALLOW_REMOTE=1 to bypass at your own risk.`,
    );
  }
}

async function recreateTestUser(): Promise<string> {
  await db.delete(user).where(eq(user.email, TEST_EMAIL));

  await auth.api.signUpEmail({
    body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: TEST_NAME },
  });

  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, TEST_EMAIL))
    .limit(1);
  if (!rows[0]) {
    throw new Error('test user creation reported success but lookup failed');
  }
  return rows[0].id;
}

async function insertSampleData(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(folders).values([
      { userId, name: 'Tech', path: '/tech', parentPath: null, position: 0 },
      { userId, name: 'News', path: '/news', parentPath: null, position: 1 },
      {
        userId,
        name: 'TypeScript',
        path: '/tech/typescript',
        parentPath: '/tech',
        position: 0,
      },
    ]);

    await tx.insert(bookmarks).values([
      {
        userId,
        url: 'https://www.typescriptlang.org/',
        title: 'TypeScript',
        folderPath: '/tech/typescript',
        position: 0,
      },
      {
        userId,
        url: 'https://hono.dev/',
        title: 'Hono - Web framework for the Edges',
        folderPath: '/tech',
        position: 0,
      },
      {
        userId,
        url: 'https://react.dev/',
        title: 'React',
        folderPath: '/tech',
        position: 1,
      },
      {
        userId,
        url: 'https://news.ycombinator.com/',
        title: 'Hacker News',
        folderPath: '/news',
        position: 0,
      },
    ]);
  });
}

async function main(): Promise<void> {
  assertLocalDatabase();
  console.log('🌱 seeding local database…');
  const userId = await recreateTestUser();
  await insertSampleData(userId);
  console.log('✅ seed complete');
  console.log(`   login: ${TEST_EMAIL} / ${TEST_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ seed failed:', err);
    process.exit(1);
  });
