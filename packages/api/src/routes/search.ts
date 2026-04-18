import { zValidator } from '@hono/zod-validator';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { auth } from '../auth.js';
import { db } from '../db/index.js';
import { bookmarks, folders } from '../db/schema.js';
import { validationHook } from '../validation-hook.js';

type Env = {
  Variables: {
    user: typeof auth.$Infer.Session.user;
    session: typeof auth.$Infer.Session.session;
  };
};

function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

const searchRoute = new Hono<Env>();

// GET /api/search?q=keyword — 横断検索
searchRoute.get(
  '/',
  zValidator(
    'query',
    z.object({
      q: z.string().trim().min(1).max(200),
    }),
    validationHook,
  ),
  async (c) => {
    const userId = c.var.user.id;
    const { q } = c.req.valid('query');

    const escaped = escapeLike(q);
    const pattern = `%${escaped}%`;

    const result = await db
      .select({
        id: bookmarks.id,
        userId: bookmarks.userId,
        folderPath: bookmarks.folderPath,
        url: bookmarks.url,
        title: bookmarks.title,
        description: bookmarks.description,
        imageUrl: bookmarks.imageUrl,
        faviconUrl: bookmarks.faviconUrl,
        position: bookmarks.position,
        deletedAt: bookmarks.deletedAt,
        createdAt: bookmarks.createdAt,
        updatedAt: bookmarks.updatedAt,
        folder: {
          id: folders.id,
          name: folders.name,
          path: folders.path,
          parentPath: folders.parentPath,
        },
      })
      .from(bookmarks)
      .leftJoin(
        folders,
        and(
          eq(bookmarks.folderPath, folders.path),
          eq(bookmarks.userId, folders.userId),
          isNull(folders.deletedAt),
        ),
      )
      .where(
        and(
          eq(bookmarks.userId, userId),
          isNull(bookmarks.deletedAt),
          sql`(${bookmarks.title} ILIKE ${pattern} ESCAPE '\\' OR ${bookmarks.url} ILIKE ${pattern} ESCAPE '\\' OR ${bookmarks.description} ILIKE ${pattern} ESCAPE '\\')`,
        ),
      )
      .orderBy(bookmarks.createdAt);

    return c.json(result);
  },
);

export { searchRoute };
