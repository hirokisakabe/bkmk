import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, gt, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { auth } from '../auth.js';
import { db } from '../db/index.js';
import { selfOrChildPathCondition } from '../db/path-helpers.js';
import { bookmarks, folders } from '../db/schema.js';
import { validationHook } from '../validation-hook.js';
import { fetchOgpMetadata, validateFetchUrl } from '../ogp.js';
import type { Env as HonoPinoEnv } from 'hono-pino';

type Env = HonoPinoEnv & {
  Variables: {
    user: typeof auth.$Infer.Session.user;
    session: typeof auth.$Infer.Session.session;
  };
};

function isUniqueViolation(err: unknown): boolean {
  if (err instanceof Error && 'code' in err && (err as { code: string }).code === '23505') {
    return true;
  }
  if (err instanceof Error && 'cause' in err) {
    return isUniqueViolation((err as { cause: unknown }).cause);
  }
  return false;
}

function encodeCursor(sortValue: string, id: string): string {
  return Buffer.from(`${sortValue}:${id}`).toString('base64url');
}

function decodeCursor(cursor: string): { sortValue: string; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString();
    const lastColon = decoded.lastIndexOf(':');
    if (lastColon === -1) return null;
    return { sortValue: decoded.slice(0, lastColon), id: decoded.slice(lastColon + 1) };
  } catch {
    return null;
  }
}

function folderPathsDepthFirst(
  allFolders: Array<{ path: string; parentPath: string | null; position: number }>,
  parentPath: string | null,
): string[] {
  const childrenByParent = new Map<
    string | null,
    Array<{ path: string; parentPath: string | null; position: number }>
  >();
  for (const folder of allFolders) {
    const children = childrenByParent.get(folder.parentPath) ?? [];
    children.push(folder);
    childrenByParent.set(folder.parentPath, children);
  }
  for (const children of childrenByParent.values()) {
    children.sort((a, b) => a.position - b.position || a.path.localeCompare(b.path));
  }

  const result: string[] = [];
  const visited = new Set<string>();
  const stack = [...(childrenByParent.get(parentPath) ?? [])].reverse();
  while (stack.length > 0) {
    const folder = stack.pop()!;
    if (visited.has(folder.path)) continue;
    visited.add(folder.path);
    result.push(folder.path);
    const children = childrenByParent.get(folder.path) ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]);
    }
  }
  return result;
}

function encodeGroupedCursor(groupRank: number, position: number, id: string): string {
  return Buffer.from(JSON.stringify({ groupRank, position, id })).toString('base64url');
}

function decodeGroupedCursor(
  cursor: string,
): { groupRank: number; position: number; id: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as Record<
      string,
      unknown
    >;
    if (
      typeof parsed.groupRank !== 'number' ||
      typeof parsed.position !== 'number' ||
      typeof parsed.id !== 'string'
    ) {
      return null;
    }
    return {
      groupRank: parsed.groupRank,
      position: parsed.position,
      id: parsed.id,
    };
  } catch {
    return null;
  }
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
        grouped: z.enum(['true', 'false']).optional(),
        cursor: z.string().optional(),
        limit: z.coerce.number().int().positive().optional(),
      }),
      validationHook,
    ),
    async (c) => {
      const userId = c.var.user.id;
      const { folder, deep, grouped, cursor, limit } = c.req.valid('query');
      const folderPath = folder ?? null;
      const isDeep = deep === 'true';
      const isGrouped = grouped === 'true';

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

      const conditions = [eq(bookmarks.userId, userId), isNull(bookmarks.deletedAt)];

      if (isDeep && folderPath !== null) {
        // folder 自身 + その配下すべて
        conditions.push(selfOrChildPathCondition(bookmarks.folderPath, folderPath));
      } else if (isDeep && folderPath === null) {
        // ルートから再帰 = 全件（deletedAt is null のみ）
      } else {
        // 直下のみ
        conditions.push(
          folderPath === null ? isNull(bookmarks.folderPath) : eq(bookmarks.folderPath, folderPath),
        );
      }

      const isAllFolder = isDeep && folderPath === null;

      if (isGrouped) {
        const allFolders = await db
          .select({
            path: folders.path,
            parentPath: folders.parentPath,
            position: folders.position,
          })
          .from(folders)
          .where(and(eq(folders.userId, userId), isNull(folders.deletedAt)));
        const folderPaths = isAllFolder
          ? [null, ...folderPathsDepthFirst(allFolders, null)]
          : [folderPath, ...folderPathsDepthFirst(allFolders, folderPath)];
        const folderRanks = new Map(folderPaths.map((path, index) => [path, index]));
        const groupOrder = sql<number>`case ${sql.join(
          folderPaths.map((path, index) =>
            path === null
              ? sql`when ${isNull(bookmarks.folderPath)} then ${index}`
              : sql`when ${eq(bookmarks.folderPath, path)} then ${index}`,
          ),
          sql.raw(' '),
        )} else 2147483647 end`;
        const parsedCursor = cursor ? decodeGroupedCursor(cursor) : null;
        if (parsedCursor) {
          conditions.push(
            or(
              gt(groupOrder, parsedCursor.groupRank),
              and(
                eq(groupOrder, parsedCursor.groupRank),
                gt(bookmarks.position, parsedCursor.position),
              ),
              and(
                eq(groupOrder, parsedCursor.groupRank),
                eq(bookmarks.position, parsedCursor.position),
                gt(bookmarks.id, parsedCursor.id),
              ),
            )!,
          );
        }
        const query = db
          .select()
          .from(bookmarks)
          .where(and(...conditions))
          .orderBy(groupOrder, bookmarks.position, bookmarks.id);

        if (limit === undefined) {
          return c.json(await query);
        }

        const result = await query.limit(limit + 1);
        const hasMore = result.length > limit;
        const data = hasMore ? result.slice(0, limit) : result;
        const lastItem = data[data.length - 1];
        const nextCursor =
          hasMore && lastItem
            ? encodeGroupedCursor(
                folderRanks.get(lastItem.folderPath) ?? 2147483647,
                lastItem.position,
                lastItem.id,
              )
            : null;

        return c.json({ data, nextCursor });
      }

      // カーソル条件を追加
      if (cursor) {
        const parsed = decodeCursor(cursor);
        if (parsed) {
          if (isAllFolder) {
            // createdAt DESC: (createdAt, id) < (cursor_createdAt, cursor_id)
            conditions.push(
              or(
                lt(bookmarks.createdAt, new Date(parsed.sortValue)),
                and(
                  eq(bookmarks.createdAt, new Date(parsed.sortValue)),
                  lt(bookmarks.id, parsed.id),
                ),
              )!,
            );
          } else {
            // position ASC: (position, id) > (cursor_position, cursor_id)
            conditions.push(
              or(
                gt(bookmarks.position, Number(parsed.sortValue)),
                and(eq(bookmarks.position, Number(parsed.sortValue)), gt(bookmarks.id, parsed.id)),
              )!,
            );
          }
        }
      }

      const query = db
        .select()
        .from(bookmarks)
        .where(and(...conditions))
        .orderBy(
          isAllFolder ? desc(bookmarks.createdAt) : bookmarks.position,
          isAllFolder ? desc(bookmarks.id) : bookmarks.id,
        );

      // limit 未指定時は全件返却（後方互換）
      if (limit === undefined) {
        const result = await query;
        return c.json(result);
      }

      // limit 指定時はページネーション
      const result = await query.limit(limit + 1);
      const hasMore = result.length > limit;
      const data = hasMore ? result.slice(0, limit) : result;

      let nextCursor: string | null = null;
      if (hasMore) {
        const lastItem = data[data.length - 1];
        const sortValue = isAllFolder
          ? new Date(lastItem.createdAt).toISOString()
          : String(lastItem.position);
        nextCursor = encodeCursor(sortValue, lastItem.id);
      }

      return c.json({ data, nextCursor });
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

      // ソフトデリート済みの同一 URL レコードがあれば物理削除
      await db
        .delete(bookmarks)
        .where(
          and(
            eq(bookmarks.userId, userId),
            eq(bookmarks.url, body.url),
            isNotNull(bookmarks.deletedAt),
          ),
        );

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
          const [existing] = await db
            .select({ folderPath: bookmarks.folderPath })
            .from(bookmarks)
            .where(and(eq(bookmarks.userId, userId), eq(bookmarks.url, body.url)));
          const folderLabel = existing?.folderPath ?? '未分類';
          return c.json(
            {
              error: `このURLはすでに「${folderLabel}」に登録されています`,
            },
            409,
          );
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

      // フォルダ移動時に position を再設定（先頭に配置）
      let newPosition = bookmark.position;
      if (body.folderPath !== undefined && body.folderPath !== bookmark.folderPath) {
        // 移動先フォルダ内の既存アイテムの position を +1 シフト
        await db
          .update(bookmarks)
          .set({ position: sql`${bookmarks.position} + 1` })
          .where(
            and(
              eq(bookmarks.userId, userId),
              newFolderPath === null
                ? isNull(bookmarks.folderPath)
                : eq(bookmarks.folderPath, newFolderPath),
              isNull(bookmarks.deletedAt),
            ),
          );
        newPosition = 0;
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
