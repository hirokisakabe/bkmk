import { and, eq, gt, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Env as HonoPinoEnv } from 'hono-pino';

import type { auth } from '../auth.js';
import { db } from '../db/index.js';
import { bookmarks } from '../db/schema.js';

type Env = HonoPinoEnv & {
  Variables: {
    user: typeof auth.$Infer.Session.user;
    session: typeof auth.$Infer.Session.session;
  };
};

const CSV_HEADER = [
  'url',
  'title',
  'description',
  'folder_path',
  'image_url',
  'favicon_url',
  'position',
  'created_at',
  'updated_at',
] as const;
const EXPORT_BATCH_SIZE = 500;

type ExportBookmark = {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  folderPath: string | null;
  imageUrl: string | null;
  faviconUrl: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
};

function escapeCsvValue(value: string | number | null): string {
  let text = value === null ? '' : String(value);

  // Spreadsheet applications may interpret these prefixes as formulas.
  if (/^[\t\r\n =+@\-＝＋＠－]/.test(text)) {
    text = `'${text}`;
  }

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function serializeBookmark(bookmark: ExportBookmark): string {
  return [
    bookmark.url,
    bookmark.title,
    bookmark.description,
    bookmark.folderPath,
    bookmark.imageUrl,
    bookmark.faviconUrl,
    bookmark.position,
    bookmark.createdAt.toISOString(),
    bookmark.updatedAt.toISOString(),
  ]
    .map(escapeCsvValue)
    .join(',');
}

async function fetchExportBatch(
  userId: string,
  cursorId: string | null,
): Promise<ExportBookmark[]> {
  const cursorCondition = cursorId ? gt(bookmarks.id, cursorId) : undefined;

  return db
    .select({
      id: bookmarks.id,
      url: bookmarks.url,
      title: bookmarks.title,
      description: bookmarks.description,
      folderPath: bookmarks.folderPath,
      imageUrl: bookmarks.imageUrl,
      faviconUrl: bookmarks.faviconUrl,
      position: bookmarks.position,
      createdAt: bookmarks.createdAt,
      updatedAt: bookmarks.updatedAt,
    })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), isNull(bookmarks.deletedAt), cursorCondition))
    .orderBy(bookmarks.id)
    .limit(EXPORT_BATCH_SIZE);
}

function createCsvStream(userId: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let rows: ExportBookmark[] = [];
  let index = 0;
  let cursorId: string | null = null;
  let reachedEnd = false;

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`\uFEFF${CSV_HEADER.join(',')}\r\n`));
    },
    async pull(controller) {
      if (index >= rows.length && !reachedEnd) {
        rows = await fetchExportBatch(userId, cursorId);
        index = 0;
        reachedEnd = rows.length < EXPORT_BATCH_SIZE;
        const last = rows.at(-1);
        if (last) {
          cursorId = last.id;
        }
      }

      const row = rows[index];
      if (!row) {
        controller.close();
        return;
      }

      controller.enqueue(encoder.encode(`${serializeBookmark(row)}\r\n`));
      index += 1;
    },
  });
}

function exportFilename(now = new Date()): string {
  return `bkmk-export-${now.toISOString().slice(0, 10)}.csv`;
}

export const exportRoute = new Hono<Env>().get('/bookmarks', async (c) => {
  const currentUser = c.var.user;

  return new Response(createCsvStream(currentUser.id), {
    headers: {
      'Content-Disposition': `attachment; filename="${exportFilename()}"`,
      'Content-Type': 'text/csv; charset=utf-8',
    },
  });
});
