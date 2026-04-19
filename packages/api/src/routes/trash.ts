import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import type { auth } from '../auth.js';
import { db } from '../db/index.js';
import { childPathCondition, rebasePath, selfOrChildPathCondition } from '../db/path-helpers.js';
import { bookmarks, folders } from '../db/schema.js';
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

const trashRoute = new Hono<Env>()
  // GET /api/trash — ゴミ箱内のフォルダ+ブックマーク一覧
  .get('/', async (c) => {
    const userId = c.var.user.id;

    const [deletedFolders, deletedBookmarks] = await Promise.all([
      db
        .select()
        .from(folders)
        .where(and(eq(folders.userId, userId), isNotNull(folders.deletedAt)))
        .orderBy(folders.deletedAt),
      db
        .select()
        .from(bookmarks)
        .where(and(eq(bookmarks.userId, userId), isNotNull(bookmarks.deletedAt)))
        .orderBy(bookmarks.deletedAt),
    ]);

    return c.json({ folders: deletedFolders, bookmarks: deletedBookmarks });
  })
  // POST /api/trash/:id/restore — アイテムを復元
  .post('/:id/restore', async (c) => {
    const userId = c.var.user.id;
    const itemId = c.req.param('id');

    // フォルダかブックマークかを検索
    const [[folder], [bookmark]] = await Promise.all([
      db
        .select()
        .from(folders)
        .where(
          and(eq(folders.id, itemId), eq(folders.userId, userId), isNotNull(folders.deletedAt)),
        ),
      db
        .select()
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.id, itemId),
            eq(bookmarks.userId, userId),
            isNotNull(bookmarks.deletedAt),
          ),
        ),
    ]);

    if (!folder && !bookmark) {
      return c.json({ error: 'Item not found in trash' }, 404);
    }

    if (folder) {
      // フォルダ復元: 配下のアイテムも一括復元

      // 復元先の親フォルダが存在するか確認
      let restoreParentPath = folder.parentPath;
      let restorePath = folder.path;

      if (folder.parentPath !== null) {
        const [parentFolder] = await db
          .select({ id: folders.id })
          .from(folders)
          .where(
            and(
              eq(folders.userId, userId),
              eq(folders.path, folder.parentPath),
              isNull(folders.deletedAt),
            ),
          )
          .limit(1);

        if (!parentFolder) {
          // 親フォルダが削除済みの場合はルートに復元
          restoreParentPath = null;
          restorePath = `/${folder.name}`;
        }
      }

      // 同一親内の既存フォルダの position を +1 シフト
      await db
        .update(folders)
        .set({ position: sql`${folders.position} + 1` })
        .where(
          and(
            eq(folders.userId, userId),
            restoreParentPath === null
              ? isNull(folders.parentPath)
              : eq(folders.parentPath, restoreParentPath),
            isNull(folders.deletedAt),
          ),
        );
      const position = 0;

      const oldPath = folder.path;

      try {
        await db.transaction(async (tx) => {
          // 自身を復元（パスが変わる場合あり）
          await tx
            .update(folders)
            .set({
              deletedAt: null,
              path: restorePath,
              parentPath: restoreParentPath,
              position,
            })
            .where(eq(folders.id, folder.id));

          // 配下のフォルダを復元（パスも更新）
          if (oldPath !== restorePath) {
            await tx
              .update(folders)
              .set({
                deletedAt: null,
                path: rebasePath(folders.path, oldPath, restorePath),
                parentPath: rebasePath(folders.parentPath, oldPath, restorePath),
              })
              .where(
                and(
                  eq(folders.userId, userId),
                  isNotNull(folders.deletedAt),
                  childPathCondition(folders.path, oldPath),
                ),
              );

            // 配下のブックマークを復元（folderPath も更新）
            await tx
              .update(bookmarks)
              .set({
                deletedAt: null,
                folderPath: rebasePath(bookmarks.folderPath, oldPath, restorePath),
              })
              .where(
                and(
                  eq(bookmarks.userId, userId),
                  isNotNull(bookmarks.deletedAt),
                  childPathCondition(bookmarks.folderPath, oldPath),
                ),
              );

            // 直下のブックマーク
            await tx
              .update(bookmarks)
              .set({ deletedAt: null, folderPath: restorePath })
              .where(
                and(
                  eq(bookmarks.userId, userId),
                  isNotNull(bookmarks.deletedAt),
                  eq(bookmarks.folderPath, oldPath),
                ),
              );
          } else {
            // パスが変わらない場合はそのまま復元
            await tx
              .update(folders)
              .set({ deletedAt: null })
              .where(
                and(
                  eq(folders.userId, userId),
                  isNotNull(folders.deletedAt),
                  childPathCondition(folders.path, oldPath),
                ),
              );

            await tx
              .update(bookmarks)
              .set({ deletedAt: null })
              .where(
                and(
                  eq(bookmarks.userId, userId),
                  isNotNull(bookmarks.deletedAt),
                  selfOrChildPathCondition(bookmarks.folderPath, folder.path),
                ),
              );
          }
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          return c.json({ error: 'このフォルダはすでに登録されています' }, 409);
        }
        throw err;
      }

      return c.json({ success: true });
    }

    // ブックマーク復元
    // 復元先フォルダが存在するか確認
    let restoreFolderPath = bookmark!.folderPath;
    if (restoreFolderPath !== null) {
      const [targetFolder] = await db
        .select({ id: folders.id })
        .from(folders)
        .where(
          and(
            eq(folders.userId, userId),
            eq(folders.path, restoreFolderPath),
            isNull(folders.deletedAt),
          ),
        )
        .limit(1);

      if (!targetFolder) {
        // フォルダが削除済みの場合はルートに復元
        restoreFolderPath = null;
      }
    }

    // 同一フォルダ内の既存アイテムの position を +1 シフト
    await db
      .update(bookmarks)
      .set({ position: sql`${bookmarks.position} + 1` })
      .where(
        and(
          eq(bookmarks.userId, userId),
          restoreFolderPath === null
            ? isNull(bookmarks.folderPath)
            : eq(bookmarks.folderPath, restoreFolderPath),
          isNull(bookmarks.deletedAt),
        ),
      );
    const position = 0;

    try {
      await db
        .update(bookmarks)
        .set({ deletedAt: null, folderPath: restoreFolderPath, position })
        .where(eq(bookmarks.id, bookmark!.id));
    } catch (err) {
      if (isUniqueViolation(err)) {
        return c.json({ error: 'このURLはすでに登録されています' }, 409);
      }
      throw err;
    }

    return c.json({ success: true });
  })
  // DELETE /api/trash/:id — アイテムを完全削除
  .delete('/:id', async (c) => {
    const userId = c.var.user.id;
    const itemId = c.req.param('id');

    // フォルダかブックマークかを検索
    const [[folder], [bookmark]] = await Promise.all([
      db
        .select()
        .from(folders)
        .where(
          and(eq(folders.id, itemId), eq(folders.userId, userId), isNotNull(folders.deletedAt)),
        ),
      db
        .select()
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.id, itemId),
            eq(bookmarks.userId, userId),
            isNotNull(bookmarks.deletedAt),
          ),
        ),
    ]);

    if (!folder && !bookmark) {
      return c.json({ error: 'Item not found in trash' }, 404);
    }

    if (folder) {
      await db.transaction(async (tx) => {
        // 配下のブックマークを完全削除
        await tx
          .delete(bookmarks)
          .where(
            and(
              eq(bookmarks.userId, userId),
              selfOrChildPathCondition(bookmarks.folderPath, folder.path),
            ),
          );

        // 配下のフォルダを完全削除
        await tx
          .delete(folders)
          .where(and(eq(folders.userId, userId), childPathCondition(folders.path, folder.path)));

        // 自身を完全削除
        await tx.delete(folders).where(eq(folders.id, folder.id));
      });

      return c.json({ success: true });
    }

    await db.delete(bookmarks).where(eq(bookmarks.id, bookmark!.id));
    return c.json({ success: true });
  })
  // DELETE /api/trash — ゴミ箱を空にする（全アイテム完全削除）
  .delete('/', async (c) => {
    const userId = c.var.user.id;

    await db.transaction(async (tx) => {
      await tx
        .delete(bookmarks)
        .where(and(eq(bookmarks.userId, userId), isNotNull(bookmarks.deletedAt)));

      await tx.delete(folders).where(and(eq(folders.userId, userId), isNotNull(folders.deletedAt)));
    });

    return c.json({ success: true });
  });

export { trashRoute };
