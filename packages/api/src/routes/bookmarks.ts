import { zValidator } from '@hono/zod-validator';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { auth } from '../auth.js';
import { db } from '../db/index.js';
import { bookmarks, folders } from '../db/schema.js';
import { validationHook } from '../validation-hook.js';
import { fetchOgpMetadata, validateFetchUrl } from '../ogp.js';

type Env = {
  Variables: {
    user: typeof auth.$Infer.Session.user;
    session: typeof auth.$Infer.Session.session;
  };
};

function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && 'code' in err && (err as { code: string }).code === '23505';
}

const bookmarksRoute = new Hono<Env>()
  // GET /api/bookmarks?folder=/work&deep=false — 一覧取得
  .get(
    '/',
    zValidator(
      'query',
      z.object({
        folder: z.string().optional(),
        deep: z.string().optional(),
      }),
      validationHook,
    ),
    async (c) => {
      const userId = c.var.user.id;
      const { folder, deep } = c.req.valid('query');
      const folderPath = folder ?? null;
      const isDeep = deep === 'true';

      const conditions = [eq(bookmarks.userId, userId), isNull(bookmarks.deletedAt)];

      if (isDeep && folderPath !== null) {
        // folder 自身 + その配下すべて
        const escaped = escapeLike(folderPath);
        conditions.push(
          sql`(${bookmarks.folderPath} = ${folderPath} OR ${bookmarks.folderPath} LIKE ${escaped + '/%'} ESCAPE '\\')`,
        );
      } else if (isDeep && folderPath === null) {
        // ルートから再帰 = 全件（deletedAt is null のみ）
      } else {
        // 直下のみ
        conditions.push(
          folderPath === null ? isNull(bookmarks.folderPath) : eq(bookmarks.folderPath, folderPath),
        );
      }

      const result = await db
        .select()
        .from(bookmarks)
        .where(and(...conditions))
        .orderBy(bookmarks.position);

      return c.json(result);
    },
  )
  // POST /api/bookmarks — ブックマーク追加（OGP自動取得）
  .post(
    '/',
    zValidator(
      'json',
      z.object({
        url: z.string().url(),
        folderPath: z.string().nullable().optional(),
      }),
      validationHook,
    ),
    async (c) => {
      const userId = c.var.user.id;
      const body = c.req.valid('json');

      if (!validateFetchUrl(body.url)) {
        return c.json({ error: 'URL must be a public http/https URL' }, 400);
      }

      const folderPath = body.folderPath ?? null;

      // フォルダが指定されている場合、存在確認
      if (folderPath !== null) {
        const [folder] = await db
          .select({ id: folders.id })
          .from(folders)
          .where(
            and(
              eq(folders.userId, userId),
              eq(folders.path, folderPath),
              isNull(folders.deletedAt),
            ),
          )
          .limit(1);

        if (!folder) {
          return c.json({ error: 'Folder not found' }, 404);
        }
      }

      // 同一フォルダ内の既存アイテムの position を +1 シフト
      await db
        .update(bookmarks)
        .set({ position: sql`${bookmarks.position} + 1` })
        .where(
          and(
            eq(bookmarks.userId, userId),
            folderPath === null
              ? isNull(bookmarks.folderPath)
              : eq(bookmarks.folderPath, folderPath),
            isNull(bookmarks.deletedAt),
          ),
        );

      const position = 0;

      // OGP メタデータを取得
      const ogp = await fetchOgpMetadata(body.url);

      try {
        const [created] = await db
          .insert(bookmarks)
          .values({
            userId,
            url: body.url,
            folderPath,
            title: ogp.title,
            description: ogp.description,
            imageUrl: ogp.imageUrl,
            faviconUrl: ogp.faviconUrl,
            position,
          })
          .returning();

        return c.json(created, 201);
      } catch (err) {
        if (isUniqueViolation(err)) {
          return c.json({ error: 'このURLはすでに登録されています' }, 409);
        }
        throw err;
      }
    },
  )
  // PATCH /api/bookmarks/:id — 移動・編集
  .patch(
    '/:id',
    zValidator(
      'json',
      z.object({
        url: z.string().url().optional(),
        title: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        folderPath: z.string().nullable().optional(),
      }),
      validationHook,
    ),
    async (c) => {
      const userId = c.var.user.id;
      const bookmarkId = c.req.param('id');
      const body = c.req.valid('json');

      const [bookmark] = await db
        .select()
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.id, bookmarkId),
            eq(bookmarks.userId, userId),
            isNull(bookmarks.deletedAt),
          ),
        );

      if (!bookmark) {
        return c.json({ error: 'Bookmark not found' }, 404);
      }

      // URL 変更時のバリデーション
      if (body.url !== undefined) {
        if (!validateFetchUrl(body.url)) {
          return c.json({ error: 'URL must be a public http/https URL' }, 400);
        }
      }

      // フォルダ移動時の存在確認
      const newFolderPath = body.folderPath !== undefined ? body.folderPath : bookmark.folderPath;
      if (body.folderPath !== undefined && body.folderPath !== null) {
        const [folder] = await db
          .select({ id: folders.id })
          .from(folders)
          .where(
            and(
              eq(folders.userId, userId),
              eq(folders.path, body.folderPath),
              isNull(folders.deletedAt),
            ),
          )
          .limit(1);

        if (!folder) {
          return c.json({ error: 'Folder not found' }, 404);
        }
      }

      // フォルダ移動時に position を再設定
      let newPosition = bookmark.position;
      if (body.folderPath !== undefined && body.folderPath !== bookmark.folderPath) {
        const maxPos = await db
          .select({ max: sql<number>`coalesce(max(${bookmarks.position}), -1)` })
          .from(bookmarks)
          .where(
            and(
              eq(bookmarks.userId, userId),
              newFolderPath === null
                ? isNull(bookmarks.folderPath)
                : eq(bookmarks.folderPath, newFolderPath),
              isNull(bookmarks.deletedAt),
            ),
          );
        newPosition = (maxPos[0]?.max ?? -1) + 1;
      }

      const updateData: Record<string, unknown> = { position: newPosition };
      if (body.url !== undefined) updateData.url = body.url;
      if (body.title !== undefined) updateData.title = body.title;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.folderPath !== undefined) updateData.folderPath = body.folderPath;

      try {
        const [updated] = await db
          .update(bookmarks)
          .set(updateData)
          .where(eq(bookmarks.id, bookmarkId))
          .returning();

        return c.json(updated);
      } catch (err) {
        if (isUniqueViolation(err)) {
          return c.json({ error: 'このURLはすでに登録されています' }, 409);
        }
        throw err;
      }
    },
  )
  // PATCH /api/bookmarks/:id/position — 同一フォルダ内での並び替え
  .patch(
    '/:id/position',
    zValidator(
      'json',
      z.object({
        position: z.number().int().nonnegative(),
      }),
      validationHook,
    ),
    async (c) => {
      const userId = c.var.user.id;
      const bookmarkId = c.req.param('id');
      const body = c.req.valid('json');

      const [bookmark] = await db
        .select()
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.id, bookmarkId),
            eq(bookmarks.userId, userId),
            isNull(bookmarks.deletedAt),
          ),
        );

      if (!bookmark) {
        return c.json({ error: 'Bookmark not found' }, 404);
      }

      const oldPosition = bookmark.position;
      const newPosition = body.position;

      if (oldPosition === newPosition) {
        return c.json(bookmark);
      }

      const folderCondition =
        bookmark.folderPath === null
          ? isNull(bookmarks.folderPath)
          : eq(bookmarks.folderPath, bookmark.folderPath);

      const [updated] = await db.transaction(async (tx) => {
        if (newPosition < oldPosition) {
          await tx
            .update(bookmarks)
            .set({ position: sql`${bookmarks.position} + 1` })
            .where(
              and(
                eq(bookmarks.userId, userId),
                folderCondition,
                isNull(bookmarks.deletedAt),
                sql`${bookmarks.position} >= ${newPosition}`,
                sql`${bookmarks.position} < ${oldPosition}`,
              ),
            );
        } else {
          await tx
            .update(bookmarks)
            .set({ position: sql`${bookmarks.position} - 1` })
            .where(
              and(
                eq(bookmarks.userId, userId),
                folderCondition,
                isNull(bookmarks.deletedAt),
                sql`${bookmarks.position} > ${oldPosition}`,
                sql`${bookmarks.position} <= ${newPosition}`,
              ),
            );
        }

        return tx
          .update(bookmarks)
          .set({ position: newPosition })
          .where(eq(bookmarks.id, bookmarkId))
          .returning();
      });

      return c.json(updated);
    },
  )
  // DELETE /api/bookmarks/:id — ソフトデリート
  .delete('/:id', async (c) => {
    const userId = c.var.user.id;
    const bookmarkId = c.req.param('id');

    const [bookmark] = await db
      .select()
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.id, bookmarkId),
          eq(bookmarks.userId, userId),
          isNull(bookmarks.deletedAt),
        ),
      );

    if (!bookmark) {
      return c.json({ error: 'Bookmark not found' }, 404);
    }

    await db.update(bookmarks).set({ deletedAt: new Date() }).where(eq(bookmarks.id, bookmarkId));

    return c.json({ success: true });
  });

export { bookmarksRoute };
