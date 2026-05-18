import { expect, test } from '@playwright/test';

import { BOOKMARKS, FOLDERS, dragTo, setupMocks } from './helpers';

test('同一フォルダ内でブックマークをDnDソートすると並び替えAPIが呼ばれる', async ({ page }) => {
  await setupMocks(page);

  // PATCH /position リクエストを事前に監視
  const patchRequest = page.waitForRequest(
    (req) => req.method() === 'PATCH' && req.url().includes('/position'),
  );

  await page.goto('/?folder=/folder-a');
  await expect(page.locator('h3', { hasText: 'Alpha' })).toBeVisible();
  await expect(page.locator('h3', { hasText: 'Beta' })).toBeVisible();

  await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText(['Alpha', 'Beta']);
  await dragTo(
    page,
    page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[0].id}`),
    page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[1].id}`),
  );

  const req = await patchRequest;
  const body = (await req.postDataJSON()) as { position: number };

  expect(req.url()).toContain(`/api/bookmarks/${BOOKMARKS[0].id}/position`);
  expect(body.position).toBe(BOOKMARKS[1].position);
  await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText(['Beta', 'Alpha']);
});

test('ブックマークを別フォルダへDnD移動すると移動APIが呼ばれる', async ({ page }) => {
  await setupMocks(page);

  // PATCH /api/bookmarks/:id (position なし) リクエストを事前に監視
  const patchRequest = page.waitForRequest(
    (req) =>
      req.method() === 'PATCH' && /\/api\/bookmarks\/[^/]+$/.test(new URL(req.url()).pathname),
  );

  await page.goto('/?folder=/folder-a');
  await expect(page.locator('h3', { hasText: 'Alpha' })).toBeVisible();

  await dragTo(
    page,
    page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[0].id}`),
    page.getByTestId(`folder-drop-target-${FOLDERS[1].id}`),
  );

  const req = await patchRequest;
  const body = (await req.postDataJSON()) as { folderPath: string | null };

  expect(req.url()).toContain(`/api/bookmarks/${BOOKMARKS[0].id}`);
  expect(body.folderPath).toBe('/folder-b');
  await expect(page.locator('h3', { hasText: 'Alpha' })).toBeHidden();

  await page.goto('/?folder=/folder-b');
  await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText(['Alpha']);
});

test('すべて表示ではブックマークの並び替えハンドルを表示せずカード本体でフォルダ移動できる', async ({
  page,
}) => {
  await setupMocks(page);

  const patchRequest = page.waitForRequest(
    (req) =>
      req.method() === 'PATCH' && /\/api\/bookmarks\/[^/]+$/.test(new URL(req.url()).pathname),
  );

  await page.goto('/');
  await expect(page.locator('h3', { hasText: 'Alpha' })).toBeVisible();
  await expect(page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[0].id}`)).toHaveCount(0);

  await dragTo(
    page,
    page.getByTestId(`bookmark-card-${BOOKMARKS[0].id}`),
    page.getByTestId(`folder-drop-target-${FOLDERS[1].id}`),
  );

  const req = await patchRequest;
  const body = (await req.postDataJSON()) as { folderPath: string | null };

  expect(req.url()).toContain(`/api/bookmarks/${BOOKMARKS[0].id}`);
  expect(body.folderPath).toBe('/folder-b');

  await page.goto('/?folder=/folder-b');
  await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText(['Alpha']);
});

test('deep表示ではブックマークの並び替えハンドルを表示せずbookmark上のdropはno-opになる', async ({
  page,
}) => {
  await setupMocks(page);

  await page.goto('/settings');
  await page.getByLabel('サブフォルダを含む').check();

  await page.goto('/?folder=/folder-a');
  await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText([
    'Alpha',
    'Gamma',
    'Beta',
  ]);
  await expect(page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[0].id}`)).toHaveCount(0);
  await expect(page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[2].id}`)).toHaveCount(0);

  const bookmarkPatchRequests: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'PATCH' && new URL(req.url()).pathname.startsWith('/api/bookmarks')) {
      bookmarkPatchRequests.push(req.url());
    }
  });

  await dragTo(
    page,
    page.getByTestId(`bookmark-card-${BOOKMARKS[0].id}`),
    page.getByTestId(`bookmark-card-${BOOKMARKS[2].id}`),
  );
  await dragTo(
    page,
    page.getByTestId(`bookmark-card-${BOOKMARKS[0].id}`),
    page.getByTestId(`bookmark-card-${BOOKMARKS[1].id}`),
  );

  expect(bookmarkPatchRequests).toEqual([]);
  await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText([
    'Alpha',
    'Gamma',
    'Beta',
  ]);
});
