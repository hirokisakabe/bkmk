import type { Locator, Page } from '@playwright/test';

import type { Bookmark, Folder } from '../src/types';

const MOCK_SESSION = {
  session: {
    id: 'test-session',
    userId: 'test-user',
    token: 'test-token',
    expiresAt: '2099-01-01T00:00:00.000Z',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  user: {
    id: 'test-user',
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
    image: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
};

export const FOLDERS: Folder[] = [
  {
    id: 'f1',
    userId: 'test-user',
    name: 'Folder A',
    path: '/folder-a',
    parentPath: null,
    position: 0,
    deletedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'f2',
    userId: 'test-user',
    name: 'Folder B',
    path: '/folder-b',
    parentPath: null,
    position: 1,
    deletedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'f3',
    userId: 'test-user',
    name: 'Folder A Child',
    path: '/folder-a/child',
    parentPath: '/folder-a',
    position: 0,
    deletedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
];

export const BOOKMARKS: Bookmark[] = [
  {
    id: 'bk-1',
    userId: 'test-user',
    url: 'https://alpha.example.com',
    title: 'Alpha',
    description: null,
    imageUrl: null,
    faviconUrl: null,
    folderPath: '/folder-a',
    position: 0,
    deletedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'bk-2',
    userId: 'test-user',
    url: 'https://beta.example.com',
    title: 'Beta',
    description: null,
    imageUrl: null,
    faviconUrl: null,
    folderPath: '/folder-a',
    position: 1,
    deletedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'bk-3',
    userId: 'test-user',
    url: 'https://gamma.example.com',
    title: 'Gamma',
    description: null,
    imageUrl: null,
    faviconUrl: null,
    folderPath: '/folder-a/child',
    position: 0,
    deletedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'bk-4',
    userId: 'test-user',
    url: 'https://delta.example.com',
    title: 'Delta',
    description: null,
    imageUrl: null,
    faviconUrl: null,
    folderPath: '/folder-b',
    position: 0,
    deletedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'bk-5',
    userId: 'test-user',
    url: 'https://epsilon.example.com',
    title: 'Epsilon',
    description: null,
    imageUrl: null,
    faviconUrl: null,
    folderPath: '/folder-b',
    position: 1,
    deletedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

export function makeBookmark(
  id: string,
  title: string,
  folderPath: string | null,
  position: number,
): Bookmark {
  return {
    id,
    userId: 'test-user',
    url: `https://${id}.example.com`,
    title,
    description: null,
    imageUrl: null,
    faviconUrl: null,
    folderPath,
    position,
    deletedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

export async function setupMocks(page: Page, extraBookmarks: Bookmark[] = []) {
  const folders = FOLDERS.map((folder) => ({ ...folder }));
  const bookmarks = [...BOOKMARKS.map((bookmark) => ({ ...bookmark })), ...extraBookmarks];

  await page.route(
    (url) => url.pathname.includes('/auth/get-session'),
    (route) => route.fulfill({ json: MOCK_SESSION }),
  );

  await page.route(
    (url) => url.pathname.startsWith('/api/folders'),
    async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const path = url.pathname;

      if (req.method() === 'PATCH' && path.endsWith('/position')) {
        const id = path.split('/').at(-2)!;
        const body = (await req.postDataJSON()) as { position: number };
        const folder = folders.find((f) => f.id === id);
        if (!folder) {
          await route.fulfill({ status: 404, json: { error: 'Folder not found' } });
          return;
        }
        const oldPosition = folder.position;
        const newPosition = body.position;
        for (const item of folders) {
          if (item.id === id || item.parentPath !== folder.parentPath) continue;
          if (
            oldPosition < newPosition &&
            item.position > oldPosition &&
            item.position <= newPosition
          ) {
            item.position -= 1;
          } else if (
            newPosition < oldPosition &&
            item.position >= newPosition &&
            item.position < oldPosition
          ) {
            item.position += 1;
          }
        }
        folder.position = newPosition;
        await route.fulfill({ json: folder });
        return;
      }

      await route.fulfill({ json: folders.toSorted((a, b) => a.position - b.position) });
    },
  );

  await page.route(
    (url) => url.pathname.startsWith('/api/bookmarks'),
    async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const path = url.pathname;

      if (req.method() === 'PATCH' && path.endsWith('/position')) {
        const id = path.split('/').at(-2)!;
        const body = (await req.postDataJSON()) as { position: number };
        const bookmark = bookmarks.find((b) => b.id === id);
        if (!bookmark) {
          await route.fulfill({ status: 404, json: { error: 'Bookmark not found' } });
          return;
        }

        const oldPosition = bookmark.position;
        const newPosition = body.position;
        for (const item of bookmarks) {
          if (item.id === id || item.folderPath !== bookmark.folderPath) continue;
          if (
            oldPosition < newPosition &&
            item.position > oldPosition &&
            item.position <= newPosition
          ) {
            item.position -= 1;
          } else if (
            newPosition < oldPosition &&
            item.position >= newPosition &&
            item.position < oldPosition
          ) {
            item.position += 1;
          }
        }
        bookmark.position = newPosition;
        await route.fulfill({ json: bookmark });
      } else if (req.method() === 'PATCH') {
        const id = path.split('/').at(-1)!;
        const body = (await req.postDataJSON()) as Partial<Bookmark>;
        const bookmark = bookmarks.find((b) => b.id === id);
        if (!bookmark) {
          await route.fulfill({ status: 404, json: { error: 'Bookmark not found' } });
          return;
        }

        if (body.folderPath !== undefined && body.folderPath !== bookmark.folderPath) {
          const sourceFolderPath = bookmark.folderPath;
          const oldPosition = bookmark.position;
          const targetFolderPath = body.folderPath ?? null;
          for (const item of bookmarks) {
            if (item.folderPath === targetFolderPath) item.position += 1;
            if (item.folderPath === sourceFolderPath && item.position > oldPosition) {
              item.position -= 1;
            }
          }
          bookmark.folderPath = targetFolderPath;
          bookmark.position = 0;
        }
        await route.fulfill({ json: bookmark });
      } else {
        const folder = url.searchParams.get('folder');
        const deep = url.searchParams.get('deep') === 'true';
        const targetFolder = folder ?? null;
        const filtered =
          targetFolder === null
            ? deep
              ? bookmarks
              : bookmarks.filter((b) => b.folderPath === null)
            : bookmarks.filter((b) =>
                deep
                  ? b.folderPath === targetFolder || b.folderPath?.startsWith(targetFolder + '/')
                  : b.folderPath === targetFolder,
              );
        filtered.sort((a, b) => a.position - b.position);
        if (url.searchParams.has('limit')) {
          await route.fulfill({ json: { data: filtered, nextCursor: null } });
          return;
        }
        await route.fulfill({ json: filtered });
      }
    },
  );
}

// @dnd-kit の PointerSensor (activationConstraint: { distance: 5 }) に対応したドラッグ操作
export async function dragTo(page: Page, from: Locator, to: Locator) {
  const fromBox = await from.boundingBox();
  const toBox = await to.boundingBox();
  if (!fromBox || !toBox) throw new Error('boundingBox が取得できませんでした');

  const fx = fromBox.x + fromBox.width / 2;
  const fy = fromBox.y + fromBox.height / 2;
  const tx = toBox.x + toBox.width / 2;
  const ty = toBox.y + toBox.height / 2;

  await page.mouse.move(fx, fy);
  await page.mouse.down();
  // 5px 以上移動してセンサーを起動
  await page.mouse.move(fx + 8, fy, { steps: 4 });
  // ターゲットへ移動
  await page.mouse.move(tx, ty, { steps: 20 });
  await page.mouse.up();
}

// to の端付近（ratioX=0.1 で左端10%、ratioX=0.9 で右端90%）にドラッグする
// 「アイテムの中心ではなくエッジ付近にドロップ」するユーザー操作を再現する
export async function dragToEdge(
  page: Page,
  from: Locator,
  to: Locator,
  ratioX: number, // 0.0=左端 / 0.5=中心 / 1.0=右端
) {
  const fromBox = await from.boundingBox();
  const toBox = await to.boundingBox();
  if (!fromBox || !toBox) throw new Error('boundingBox が取得できませんでした');

  const fx = fromBox.x + fromBox.width / 2;
  const fy = fromBox.y + fromBox.height / 2;
  const tx = toBox.x + toBox.width * ratioX;
  const ty = toBox.y + toBox.height / 2;

  await page.mouse.move(fx, fy);
  await page.mouse.down();
  await page.mouse.move(fx + 8, fy, { steps: 4 });
  await page.mouse.move(tx, ty, { steps: 20 });
  await page.mouse.up();
}
