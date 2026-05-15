import { PGlite } from '@electric-sql/pglite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

import { bookmarks, folders, user } from '../db/schema.js';
import { createTestApp, TEST_USER } from '../test/helpers.js';

const testSchema = { bookmarks, folders, user };

const testDb = vi.hoisted(() => ({
  db: undefined as PgliteDatabase<typeof testSchema> | undefined,
}));

vi.mock('../db/index.js', () => ({
  get db() {
    if (!testDb.db) {
      throw new Error('Test database has not been initialized');
    }
    return testDb.db;
  },
}));

async function applyMigrations() {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const drizzleDir = resolve(testDir, '../../../../drizzle');
  await migrate(testDb.db!, { migrationsFolder: drizzleDir });
}

describe('GET /api/bookmarks integration', () => {
  let client: PGlite;
  let app: ReturnType<typeof createTestApp>;

  beforeAll(async () => {
    client = new PGlite();
    testDb.db = drizzle({ client, schema: testSchema });
    await applyMigrations();

    const { bookmarksRoute } = await import('./bookmarks.js');
    app = createTestApp('/api/bookmarks', bookmarksRoute);
  });

  afterAll(async () => {
    await client.close();
  });

  it('deep=true のカーソルページネーションで同一 position のブックマークを重複・欠落なく取得できる', async () => {
    const now = new Date('2024-01-01T00:00:00.000Z');

    await testDb.db!.insert(user).values({
      ...TEST_USER,
      createdAt: now,
      updatedAt: now,
    });

    await testDb.db!.insert(folders).values([
      {
        id: '00000000-0000-0000-0000-000000000101',
        userId: TEST_USER.id,
        name: 'work',
        path: '/work',
        parentPath: null,
        position: 0,
      },
      {
        id: '00000000-0000-0000-0000-000000000102',
        userId: TEST_USER.id,
        name: 'frontend',
        path: '/work/frontend',
        parentPath: '/work',
        position: 0,
      },
      {
        id: '00000000-0000-0000-0000-000000000103',
        userId: TEST_USER.id,
        name: 'backend',
        path: '/work/backend',
        parentPath: '/work',
        position: 0,
      },
    ]);

    const expectedIds = [
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000005',
    ];

    await testDb.db!.insert(bookmarks).values([
      {
        id: expectedIds[2],
        userId: TEST_USER.id,
        folderPath: '/work/frontend',
        url: 'https://example.com/frontend-3',
        title: 'frontend 3',
        position: 0,
      },
      {
        id: expectedIds[0],
        userId: TEST_USER.id,
        folderPath: '/work',
        url: 'https://example.com/work-1',
        title: 'work 1',
        position: 0,
      },
      {
        id: expectedIds[1],
        userId: TEST_USER.id,
        folderPath: '/work/backend',
        url: 'https://example.com/backend-2',
        title: 'backend 2',
        position: 0,
      },
      {
        id: expectedIds[4],
        userId: TEST_USER.id,
        folderPath: '/work/frontend',
        url: 'https://example.com/frontend-5',
        title: 'frontend 5',
        position: 0,
      },
      {
        id: expectedIds[3],
        userId: TEST_USER.id,
        folderPath: '/work/backend',
        url: 'https://example.com/backend-4',
        title: 'backend 4',
        position: 0,
      },
    ]);

    const fetchedIds: string[] = [];
    let cursor: string | null = null;
    const pageLengths: number[] = [];

    do {
      const params = new URLSearchParams({
        folder: '/work',
        deep: 'true',
        limit: '2',
      });
      if (cursor) {
        params.set('cursor', cursor);
      }

      const res = await app.request(`/api/bookmarks?${params}`);

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Array<{ id: string }>;
        nextCursor: string | null;
      };

      fetchedIds.push(...body.data.map((bookmark) => bookmark.id));
      pageLengths.push(body.data.length);
      cursor = body.nextCursor;
    } while (cursor);

    expect(pageLengths).toEqual([2, 2, 1]);
    expect(fetchedIds).toHaveLength(expectedIds.length);
    expect(new Set(fetchedIds).size).toBe(expectedIds.length);
    expect(fetchedIds).toEqual(expectedIds);
  });
});
