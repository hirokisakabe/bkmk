import { PGlite } from '@electric-sql/pglite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, asc, eq, isNull } from 'drizzle-orm';
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

const now = new Date('2024-01-01T00:00:00.000Z');
const otherUser = {
  ...TEST_USER,
  id: 'other-user-id',
  email: 'other@example.com',
};

describe('DnD position integration', () => {
  let client: PGlite;
  let bookmarksApp: ReturnType<typeof createTestApp>;
  let foldersApp: ReturnType<typeof createTestApp>;

  beforeEach(async () => {
    client = new PGlite();
    testDb.db = drizzle({ client, schema: testSchema });
    await applyMigrations();

    const [{ bookmarksRoute }, { foldersRoute }] = await Promise.all([
      import('./bookmarks.js'),
      import('./folders.js'),
    ]);
    bookmarksApp = createTestApp('/api/bookmarks', bookmarksRoute);
    foldersApp = createTestApp('/api/folders', foldersRoute);

    await testDb.db!.insert(user).values([
      { ...TEST_USER, createdAt: now, updatedAt: now },
      { ...otherUser, createdAt: now, updatedAt: now },
    ]);
  });

  afterEach(async () => {
    await client.close();
    testDb.db = undefined;
  });

  async function bookmarkOrder(folderPath: string | null, userId = TEST_USER.id) {
    const conditions = [
      eq(bookmarks.userId, userId),
      folderPath === null ? isNull(bookmarks.folderPath) : eq(bookmarks.folderPath, folderPath),
      isNull(bookmarks.deletedAt),
    ];
    const rows = await testDb
      .db!.select({ id: bookmarks.id, position: bookmarks.position })
      .from(bookmarks)
      .where(and(...conditions))
      .orderBy(asc(bookmarks.position));
    return rows.map((row) => `${row.id}:${row.position}`);
  }

  async function folderOrder(parentPath: string | null, userId = TEST_USER.id) {
    const conditions = [
      eq(folders.userId, userId),
      parentPath === null ? isNull(folders.parentPath) : eq(folders.parentPath, parentPath),
      isNull(folders.deletedAt),
    ];
    const rows = await testDb
      .db!.select({ id: folders.id, position: folders.position })
      .from(folders)
      .where(and(...conditions))
      .orderBy(asc(folders.position));
    return rows.map((row) => `${row.id}:${row.position}`);
  }

  it('bookmark position は前から後ろへ並び替え、別ユーザー・別フォルダ・削除済みを巻き込まない', async () => {
    await testDb.db!.insert(bookmarks).values([
      {
        id: '00000000-0000-0000-0000-000000000101',
        userId: TEST_USER.id,
        url: 'https://example.com/a',
        title: 'a',
        folderPath: '/work',
        position: 0,
      },
      {
        id: '00000000-0000-0000-0000-000000000102',
        userId: TEST_USER.id,
        url: 'https://example.com/b',
        title: 'b',
        folderPath: '/work',
        position: 1,
      },
      {
        id: '00000000-0000-0000-0000-000000000103',
        userId: TEST_USER.id,
        url: 'https://example.com/c',
        title: 'c',
        folderPath: '/work',
        position: 2,
      },
      {
        id: '00000000-0000-0000-0000-000000000104',
        userId: TEST_USER.id,
        url: 'https://example.com/other-folder',
        title: 'other folder',
        folderPath: '/personal',
        position: 0,
      },
      {
        id: '00000000-0000-0000-0000-000000000105',
        userId: otherUser.id,
        url: 'https://example.com/other-user',
        title: 'other user',
        folderPath: '/work',
        position: 0,
      },
      {
        id: '00000000-0000-0000-0000-000000000106',
        userId: TEST_USER.id,
        url: 'https://example.com/deleted',
        title: 'deleted',
        folderPath: '/work',
        position: 1,
        deletedAt: now,
      },
    ]);

    const res = await bookmarksApp.request(
      '/api/bookmarks/00000000-0000-0000-0000-000000000101/position',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: 2 }),
      },
    );

    expect(res.status).toBe(200);
    expect(await bookmarkOrder('/work')).toEqual([
      '00000000-0000-0000-0000-000000000102:0',
      '00000000-0000-0000-0000-000000000103:1',
      '00000000-0000-0000-0000-000000000101:2',
    ]);
    expect(await bookmarkOrder('/personal')).toEqual(['00000000-0000-0000-0000-000000000104:0']);
    expect(await bookmarkOrder('/work', otherUser.id)).toEqual([
      '00000000-0000-0000-0000-000000000105:0',
    ]);
  });

  it('bookmark position は後ろから前へ並び替える', async () => {
    await testDb.db!.insert(bookmarks).values([
      {
        id: '00000000-0000-0000-0000-000000000201',
        userId: TEST_USER.id,
        url: 'https://example.com/a2',
        title: 'a',
        folderPath: null,
        position: 0,
      },
      {
        id: '00000000-0000-0000-0000-000000000202',
        userId: TEST_USER.id,
        url: 'https://example.com/b2',
        title: 'b',
        folderPath: null,
        position: 1,
      },
      {
        id: '00000000-0000-0000-0000-000000000203',
        userId: TEST_USER.id,
        url: 'https://example.com/c2',
        title: 'c',
        folderPath: null,
        position: 2,
      },
    ]);

    const res = await bookmarksApp.request(
      '/api/bookmarks/00000000-0000-0000-0000-000000000203/position',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: 0 }),
      },
    );

    expect(res.status).toBe(200);
    expect(await bookmarkOrder(null)).toEqual([
      '00000000-0000-0000-0000-000000000203:0',
      '00000000-0000-0000-0000-000000000201:1',
      '00000000-0000-0000-0000-000000000202:2',
    ]);
  });

  it('folder position は前から後ろへ並び替え、別ユーザー・別parentPath・削除済みを巻き込まない', async () => {
    await testDb.db!.insert(folders).values([
      {
        id: '00000000-0000-0000-0000-000000000301',
        userId: TEST_USER.id,
        name: 'a',
        path: '/a',
        parentPath: null,
        position: 0,
      },
      {
        id: '00000000-0000-0000-0000-000000000302',
        userId: TEST_USER.id,
        name: 'b',
        path: '/b',
        parentPath: null,
        position: 1,
      },
      {
        id: '00000000-0000-0000-0000-000000000303',
        userId: TEST_USER.id,
        name: 'c',
        path: '/c',
        parentPath: null,
        position: 2,
      },
      {
        id: '00000000-0000-0000-0000-000000000304',
        userId: TEST_USER.id,
        name: 'child',
        path: '/a/child',
        parentPath: '/a',
        position: 0,
      },
      {
        id: '00000000-0000-0000-0000-000000000305',
        userId: otherUser.id,
        name: 'other',
        path: '/other',
        parentPath: null,
        position: 0,
      },
      {
        id: '00000000-0000-0000-0000-000000000306',
        userId: TEST_USER.id,
        name: 'deleted',
        path: '/deleted',
        parentPath: null,
        position: 1,
        deletedAt: now,
      },
    ]);

    const res = await foldersApp.request(
      '/api/folders/00000000-0000-0000-0000-000000000301/position',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: 2 }),
      },
    );

    expect(res.status).toBe(200);
    expect(await folderOrder(null)).toEqual([
      '00000000-0000-0000-0000-000000000302:0',
      '00000000-0000-0000-0000-000000000303:1',
      '00000000-0000-0000-0000-000000000301:2',
    ]);
    expect(await folderOrder('/a')).toEqual(['00000000-0000-0000-0000-000000000304:0']);
    expect(await folderOrder(null, otherUser.id)).toEqual([
      '00000000-0000-0000-0000-000000000305:0',
    ]);
  });

  it('folder position は後ろから前へ並び替える', async () => {
    await testDb.db!.insert(folders).values([
      {
        id: '00000000-0000-0000-0000-000000000401',
        userId: TEST_USER.id,
        name: 'a2',
        path: '/a2',
        parentPath: null,
        position: 0,
      },
      {
        id: '00000000-0000-0000-0000-000000000402',
        userId: TEST_USER.id,
        name: 'b2',
        path: '/b2',
        parentPath: null,
        position: 1,
      },
      {
        id: '00000000-0000-0000-0000-000000000403',
        userId: TEST_USER.id,
        name: 'c2',
        path: '/c2',
        parentPath: null,
        position: 2,
      },
    ]);

    const res = await foldersApp.request(
      '/api/folders/00000000-0000-0000-0000-000000000403/position',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: 0 }),
      },
    );

    expect(res.status).toBe(200);
    expect(await folderOrder(null)).toEqual([
      '00000000-0000-0000-0000-000000000403:0',
      '00000000-0000-0000-0000-000000000401:1',
      '00000000-0000-0000-0000-000000000402:2',
    ]);
  });
});
