import { zValidator } from '@hono/zod-validator';
import { and, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { auth } from '../auth.js';
import { db } from '../db/index.js';
import { childPathCondition, rebasePath, selfOrChildPathCondition } from '../db/path-helpers.js';
import { bookmarks, folders } from '../db/schema.js';
import { validationHook } from '../validation-hook.js';
import type { Env as HonoPinoEnv } from 'hono-pino';

type Env = HonoPinoEnv & {
  Variables: {
    user: typeof auth.$Infer.Session.user;
    session: typeof auth.$Infer.Session.session;
  };
};

const VALID_SEGMENT =
  /^[a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF._\- \p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u;
const MAX_NAME_LENGTH = 255;

function validateSegments(segments: string[]): string | null {
  for (const seg of segments) {
    if (seg.length === 0 || seg.length > MAX_NAME_LENGTH) {
      return 'Each path segment must be 1-255 characters';
    }
    if (seg !== seg.trim()) {
      return 'Path segments must not have leading or trailing whitespace';
    }
    if (!VALID_SEGMENT.test(seg)) {
      return 'Path segments may only contain alphanumeric, CJK, emoji, dot, hyphen, underscore, or space characters';
    }
  }
  return null;
}

function isUniqueViolation(err: unknown): boolean {
  if (err instanceof Error && 'code' in err && (err as { code: string }).code === '23505') {
    return true;
  }
  if (err instanceof Error && 'cause' in err) {
    return isUniqueViolation((err as { cause: unknown }).cause);
  }
  return false;
}

const foldersRoute = new Hono<Env>()
  // GET /api/folders?parent=/work — 指定パス直下のフォルダ一覧
  // GET /api/folders?all=true   — 全フォルダ一括取得
  .get(
    '/',
    zValidator(
      'query',
      z.object({
        parent: z.string().optional(),
        all: z
          .enum(['true', 'false'])
          .transform((v) => v === 'true')
          .optional(),
      }),
      validationHook,
    ),
    async (c) => {
      const userId = c.var.user.id;
      const { parent, all } = c.req.valid('query');

      if (all) {
        const result = await db
          .select()
          .from(folders)
          .where(and(eq(folders.userId, userId), isNull(folders.deletedAt)))
          .orderBy(folders.position);

        return c.json(result);
      }

      const parentPath = parent ?? null;

      const result = await db
        .select()
        .from(folders)
        .where(
          and(
            eq(folders.userId, userId),
            parentPath === null ? isNull(folders.parentPath) : eq(folders.parentPath, parentPath),
            isNull(folders.deletedAt),
          ),
        )
        .orderBy(folders.position);

      return c.json(result);
    },
  )
  // POST /api/folders — フォルダ作成
  .post(
    '/',
    zValidator(
      'json',
      z.object({
        path: z.string().startsWith('/'),
      }),
      validationHook,
    ),
    async (c) => {
      const userId = c.var.user.id;
      const body = c.req.valid('json');

      // 末尾スラッシュを正規化（例: "/foo/" → "/foo"）
      const normalizedPath = body.path.replace(/\/+$/, '') || '/';

      const segments = normalizedPath.split('/').filter(Boolean);
      if (segments.length === 0) {
        return c.json({ error: 'Invalid path' }, 400);
      }

      const segError = validateSegments(segments);
      if (segError) {
        return c.json({ error: segError }, 400);
      }

      const name = segments[segments.length - 1];
      const parentPath = segments.length === 1 ? null : '/' + segments.slice(0, -1).join('/');

      // 親フォルダが存在するか確認（ルート直下でない場合）
      if (parentPath !== null) {
        const parentFolder = await db
          .select({ id: folders.id })
          .from(folders)
          .where(
            and(
              eq(folders.userId, userId),
              eq(folders.path, parentPath),
              isNull(folders.deletedAt),
            ),
          )
          .limit(1);

        if (parentFolder.length === 0) {
          return c.json({ error: 'Parent folder not found' }, 404);
        }
      }

      // ソフトデリート済みの同一パスレコードがあれば物理削除
      await db
        .delete(folders)
        .where(
          and(
            eq(folders.userId, userId),
            eq(folders.path, normalizedPath),
            isNotNull(folders.deletedAt),
          ),
        );

      // 同一親内の既存フォルダの position を +1 シフト
      await db
        .update(folders)
        .set({ position: sql`${folders.position} + 1` })
        .where(
          and(
            eq(folders.userId, userId),
            parentPath === null ? isNull(folders.parentPath) : eq(folders.parentPath, parentPath),
            isNull(folders.deletedAt),
          ),
        );

      const position = 0;

      try {
        const [created] = await db
          .insert(folders)
          .values({
            userId,
            name,
            path: normalizedPath,
            parentPath,
            position,
          })
          .returning();

        return c.json(created, 201);
      } catch (err) {
        if (isUniqueViolation(err)) {
          return c.json({ error: 'このフォルダはすでに登録されています' }, 409);
        }
        throw err;
      }
    },
  )
  // PATCH /api/folders/:id — 名前変更・移動
  .patch(
    '/:id',
    zValidator(
      'json',
      z.object({
        name: z.string().optional(),
        parentPath: z.string().startsWith('/').nullable().optional(),
      }),
      validationHook,
    ),
    async (c) => {
      const userId = c.var.user.id;
      const folderId = c.req.param('id');
      const body = c.req.valid('json');

      if (body.name !== undefined) {
        const nameError = validateSegments([body.name]);
        if (nameError) {
          return c.json({ error: nameError }, 400);
        }
      }

      if (body.parentPath !== undefined && body.parentPath !== null) {
        const parentSegments = body.parentPath.split('/').filter(Boolean);
        const parentSegError = validateSegments(parentSegments);
        if (parentSegError) {
          return c.json({ error: parentSegError }, 400);
        }
      }

      const [folder] = await db
        .select()
        .from(folders)
        .where(
          and(eq(folders.id, folderId), eq(folders.userId, userId), isNull(folders.deletedAt)),
        );

      if (!folder) {
        return c.json({ error: 'Folder not found' }, 404);
      }

      const newName = body.name ?? folder.name;
      const newParentPath = body.parentPath !== undefined ? body.parentPath : folder.parentPath;
      const newPath = newParentPath === null ? `/${newName}` : `${newParentPath}/${newName}`;

      // 移動先の親フォルダが存在するか確認
      if (newParentPath !== null) {
        const parentFolder = await db
          .select({ id: folders.id })
          .from(folders)
          .where(
            and(
              eq(folders.userId, userId),
              eq(folders.path, newParentPath),
              isNull(folders.deletedAt),
            ),
          )
          .limit(1);

        if (parentFolder.length === 0) {
          return c.json({ error: 'Parent folder not found' }, 404);
        }
      }

      // 自分自身の配下に移動しようとしていないかチェック
      if (newParentPath !== null && newParentPath.startsWith(folder.path + '/')) {
        return c.json({ error: 'Cannot move folder into its own subtree' }, 400);
      }

      const oldPath = folder.path;

      // パスが変わる場合、子フォルダのパス衝突を事前チェック
      if (oldPath !== newPath) {
        // 配下のフォルダを取得
        const childFolders = await db
          .select({ path: folders.path })
          .from(folders)
          .where(and(eq(folders.userId, userId), childPathCondition(folders.path, oldPath)));

        if (childFolders.length > 0) {
          // 移動後のパスを計算
          const newChildPaths = childFolders.map(
            (child) => newPath + child.path.substring(oldPath.length),
          );

          // 衝突チェック: 移動後のパスが既存フォルダと重複しないか
          const conflicting = await db
            .select({ id: folders.id })
            .from(folders)
            .where(
              and(
                eq(folders.userId, userId),
                sql`${folders.path} IN ${newChildPaths}`,
                isNull(folders.deletedAt),
              ),
            )
            .limit(1);

          if (conflicting.length > 0) {
            return c.json({ error: 'このフォルダはすでに登録されています' }, 409);
          }
        }
      }

      // 移動時に position を再設定
      let newPosition = folder.position;
      if (newParentPath !== folder.parentPath) {
        const maxPos = await db
          .select({ max: sql<number>`coalesce(max(${folders.position}), -1)` })
          .from(folders)
          .where(
            and(
              eq(folders.userId, userId),
              newParentPath === null
                ? isNull(folders.parentPath)
                : eq(folders.parentPath, newParentPath),
              isNull(folders.deletedAt),
            ),
          );
        newPosition = (maxPos[0]?.max ?? -1) + 1;
      }

      try {
        const [updated] = await db.transaction(async (tx) => {
          // パスが変わる場合は配下のフォルダ・ブックマークも一括更新
          if (oldPath !== newPath) {
            // 配下のフォルダの path と parentPath を更新
            await tx
              .update(folders)
              .set({
                path: rebasePath(folders.path, oldPath, newPath),
                parentPath: rebasePath(folders.parentPath, oldPath, newPath),
              })
              .where(and(eq(folders.userId, userId), childPathCondition(folders.path, oldPath)));

            // 配下のブックマークの folderPath を更新
            await tx
              .update(bookmarks)
              .set({
                folderPath: rebasePath(bookmarks.folderPath, oldPath, newPath),
              })
              .where(
                and(
                  eq(bookmarks.userId, userId),
                  childPathCondition(bookmarks.folderPath, oldPath),
                ),
              );

            // 直下のブックマーク（folderPath が oldPath と完全一致）も更新
            await tx
              .update(bookmarks)
              .set({ folderPath: newPath })
              .where(and(eq(bookmarks.userId, userId), eq(bookmarks.folderPath, oldPath)));
          }

          // 移動対象フォルダ自体を更新
          return tx
            .update(folders)
            .set({
              name: newName,
              path: newPath,
              parentPath: newParentPath,
              position: newPosition,
            })
            .where(eq(folders.id, folderId))
            .returning();
        });

        return c.json(updated);
      } catch (err) {
        if (isUniqueViolation(err)) {
          return c.json({ error: 'このフォルダはすでに登録されています' }, 409);
        }
        throw err;
      }
    },
  )
  // PATCH /api/folders/:id/position — 同一親内での並び替え
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
      const folderId = c.req.param('id');
      const body = c.req.valid('json');

      const [folder] = await db
        .select()
        .from(folders)
        .where(
          and(eq(folders.id, folderId), eq(folders.userId, userId), isNull(folders.deletedAt)),
        );

      if (!folder) {
        return c.json({ error: 'Folder not found' }, 404);
      }

      const oldPosition = folder.position;
      const newPosition = body.position;

      if (oldPosition === newPosition) {
        return c.json(folder);
      }

      const parentCondition =
        folder.parentPath === null
          ? isNull(folders.parentPath)
          : eq(folders.parentPath, folder.parentPath);

      // 間のフォルダの position をシフト
      if (newPosition < oldPosition) {
        // 上に移動: newPosition <= pos < oldPosition の項目を +1
        await db
          .update(folders)
          .set({ position: sql`${folders.position} + 1` })
          .where(
            and(
              eq(folders.userId, userId),
              parentCondition,
              isNull(folders.deletedAt),
              sql`${folders.position} >= ${newPosition}`,
              sql`${folders.position} < ${oldPosition}`,
            ),
          );
      } else {
        // 下に移動: oldPosition < pos <= newPosition の項目を -1
        await db
          .update(folders)
          .set({ position: sql`${folders.position} - 1` })
          .where(
            and(
              eq(folders.userId, userId),
              parentCondition,
              isNull(folders.deletedAt),
              sql`${folders.position} > ${oldPosition}`,
              sql`${folders.position} <= ${newPosition}`,
            ),
          );
      }

      const [updated] = await db
        .update(folders)
        .set({ position: newPosition })
        .where(eq(folders.id, folderId))
        .returning();

      return c.json(updated);
    },
  )
  // DELETE /api/folders/:id — ソフトデリート（配下ごと）
  .delete('/:id', async (c) => {
    const userId = c.var.user.id;
    const folderId = c.req.param('id');

    const [folder] = await db
      .select()
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.userId, userId), isNull(folders.deletedAt)));

    if (!folder) {
      return c.json({ error: 'Folder not found' }, 404);
    }

    const now = new Date();

    // 自身と配下のフォルダを一括ソフトデリート
    await db
      .update(folders)
      .set({ deletedAt: now })
      .where(
        and(
          eq(folders.userId, userId),
          isNull(folders.deletedAt),
          or(eq(folders.id, folderId), childPathCondition(folders.path, folder.path)),
        ),
      );

    // 配下のブックマークも一括ソフトデリート
    await db
      .update(bookmarks)
      .set({ deletedAt: now })
      .where(
        and(
          eq(bookmarks.userId, userId),
          isNull(bookmarks.deletedAt),
          selfOrChildPathCondition(bookmarks.folderPath, folder.path),
        ),
      );

    return c.json({ success: true });
  });

export { foldersRoute };
