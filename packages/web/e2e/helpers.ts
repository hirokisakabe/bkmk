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

const FOLDERS: Folder[] = [
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
];

export async function setupMocks(page: Page) {
  await page.route(
    (url) => url.pathname.includes('/auth/get-session'),
    (route) => route.fulfill({ json: MOCK_SESSION }),
  );

  await page.route(
    (url) => url.pathname.startsWith('/api/folders'),
    (route) => route.fulfill({ json: FOLDERS }),
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
        const bk = BOOKMARKS.find((b) => b.id === id);
        await route.fulfill({ json: { ...bk, ...body } });
      } else if (req.method() === 'PATCH') {
        const id = path.split('/').at(-1)!;
        const body = (await req.postDataJSON()) as Partial<Bookmark>;
        const bk = BOOKMARKS.find((b) => b.id === id);
        await route.fulfill({ json: { ...bk, ...body } });
      } else {
        const folder = url.searchParams.get('folder');
        const filtered = BOOKMARKS.filter((b) => b.folderPath === (folder ?? null));
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
