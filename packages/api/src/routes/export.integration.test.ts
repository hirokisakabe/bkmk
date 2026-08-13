import { PGlite } from '@electric-sql/pglite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

import { bookmarks, user } from '../db/schema.js';
import { createTestApp, TEST_USER } from '../test/helpers.js';

const testSchema = { bookmarks, user };

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

describe('GET /api/export/bookmarks integration', () => {
  let client: PGlite;
  let app: ReturnType<typeof createTestApp>;

  beforeAll(async () => {
    client = new PGlite();
    testDb.db = drizzle({ client, schema: testSchema });
    await applyMigrations();

    const now = new Date('2026-08-14T00:00:00.000Z');
    await testDb.db.insert(user).values([
      { ...TEST_USER, createdAt: now, updatedAt: now },
      {
        id: 'other-user-id',
        name: 'Other User',
        email: 'other@example.com',
        emailVerified: true,
        image: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await testDb.db.insert(bookmarks).values([
      {
        id: '00000000-0000-0000-0000-000000000001',
        userId: TEST_USER.id,
        url: 'https://active.example.com',
        title: 'active',
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        userId: TEST_USER.id,
        url: 'https://deleted.example.com',
        title: 'deleted',
        deletedAt: now,
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        userId: 'other-user-id',
        url: 'https://other.example.com',
        title: 'other',
      },
    ]);

    const { exportRoute } = await import('./export.js');
    app = createTestApp('/api/export', exportRoute);
  });

  afterAll(async () => {
    await client.close();
  });

  it('認証ユーザーのゴミ箱外ブックマークだけを出力する', async () => {
    const res = await app.request('/api/export/bookmarks');
    const csv = await res.text();

    expect(csv).toContain('https://active.example.com');
    expect(csv).not.toContain('https://deleted.example.com');
    expect(csv).not.toContain('https://other.example.com');
    expect(csv).not.toContain(TEST_USER.id);
    expect(csv).not.toContain('00000000-0000-0000-0000-000000000001');
  });
});
