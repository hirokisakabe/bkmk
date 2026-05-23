import { eq } from 'drizzle-orm';

import { auth } from './auth.js';
import { db } from './db/index.js';
import { bookmarks, folders, user } from './db/schema.js';

const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password1234';
const TEST_NAME = 'Test User';

async function findUserIdByEmail(email: string): Promise<string | null> {
  const rows = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  return rows[0]?.id ?? null;
}

async function ensureTestUser(): Promise<string> {
  const existingId = await findUserIdByEmail(TEST_EMAIL);
  if (existingId) {
    console.log(`✓ test user already exists: ${TEST_EMAIL}`);
    return existingId;
  }

  console.log(`+ creating test user: ${TEST_EMAIL}`);
  await auth.api.signUpEmail({
    body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: TEST_NAME },
  });

  const createdId = await findUserIdByEmail(TEST_EMAIL);
  if (!createdId) {
    throw new Error('test user creation reported success but lookup failed');
  }
  return createdId;
}

async function reseedSampleData(userId: string): Promise<void> {
  await db.delete(bookmarks).where(eq(bookmarks.userId, userId));
  await db.delete(folders).where(eq(folders.userId, userId));

  await db.insert(folders).values([
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

  await db.insert(bookmarks).values([
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
}

async function main(): Promise<void> {
  console.log('🌱 seeding local database…');
  const userId = await ensureTestUser();
  await reseedSampleData(userId);
  console.log('✅ seed complete');
  console.log(`   login: ${TEST_EMAIL} / ${TEST_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ seed failed:', err);
    process.exit(1);
  });
