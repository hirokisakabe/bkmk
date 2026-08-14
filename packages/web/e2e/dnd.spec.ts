import { expect, test } from '@playwright/test';

import { BOOKMARKS, FOLDERS, dragTo, makeBookmark, setupMocks } from './helpers';

test('同一階層のフォルダをDnDソートすると並び替えAPIが呼ばれる', async ({ page }) => {
  await setupMocks(page);

  const patchRequest = page.waitForRequest(
    (req) =>
      req.method() === 'PATCH' &&
      /\/api\/folders\/[^/]+\/position$/.test(new URL(req.url()).pathname),
  );

  // デスクトップ viewport でサイドバーを md:static に切り替える
  // （モバイル固定 overlay では CSS transform アニメーション後に dnd-kit の bounding rect キャッシュが更新されず
  //   collision detection が誤動作するため）
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByTestId(`folder-drop-target-${FOLDERS[0].id}`).waitFor();
  await page.getByTestId(`folder-drop-target-${FOLDERS[1].id}`).waitFor();

  // Folder A (pos=0) → Folder B (pos=1) へドラッグ（同一階層ソート）
  const sourceHandle = page.getByTestId(`folder-drag-handle-${FOLDERS[0].id}`);
  const targetHandle = page.getByTestId(`folder-drag-handle-${FOLDERS[1].id}`);
  const sourceBox = await sourceHandle.boundingBox();
  const targetBox = await targetHandle.boundingBox();
  if (!sourceBox || !targetBox) throw new Error('boundingBox が取得できませんでした');
  const sourceX = sourceBox.x + sourceBox.width / 2;
  const sourceY = sourceBox.y + sourceBox.height / 2;
  await page.mouse.move(sourceX, sourceY);
  await page.mouse.down();
  await page.mouse.move(sourceX + 8, sourceY, { steps: 4 });
  // sortable preview で target row が動く前に、測定済みの中心へ直接 pointer を置く。
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
  await page.mouse.up();

  const req = await patchRequest;
  const body = (await req.postDataJSON()) as { position: number };

  expect(req.url()).toContain(`/api/folders/${FOLDERS[0].id}/position`);
  expect(body.position).toBe(FOLDERS[1].position);

  // Folder B が Folder A より上に表示される（リトライ付き）
  await expect(async () => {
    const boxA = await page.getByTestId(`folder-drop-target-${FOLDERS[0].id}`).boundingBox();
    const boxB = await page.getByTestId(`folder-drop-target-${FOLDERS[1].id}`).boundingBox();
    expect(boxB!.y).toBeLessThan(boxA!.y);
  }).toPass();
});

test('別階層のフォルダへDnDしても並び替えAPIは呼ばれない', async ({ page }) => {
  await setupMocks(page);

  // デスクトップ viewport でサイドバーを md:static に切り替える
  await page.setViewportSize({ width: 1280, height: 900 });
  // folder-a/child を選択すると folder-a (f1) が展開され f3 が表示される
  await page.goto(`/?folder=${encodeURIComponent('/folder-a/child')}`);
  await page.getByTestId(`folder-drop-target-${FOLDERS[2].id}`).waitFor(); // f3: Folder A Child
  await page.getByTestId(`folder-drop-target-${FOLDERS[1].id}`).waitFor(); // f2: Folder B

  const folderPatchRequests: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'PATCH' && new URL(req.url()).pathname.startsWith('/api/folders')) {
      folderPatchRequests.push(req.url());
    }
  });

  // f3 (parentPath='/folder-a') → f2 (parentPath=null) へドラッグ（別階層: no-op）
  await dragTo(
    page,
    page.getByTestId(`folder-drag-handle-${FOLDERS[2].id}`),
    page.getByTestId(`folder-drag-handle-${FOLDERS[1].id}`),
  );

  expect(folderPatchRequests).toEqual([]);
  // f3 は f1 配下のまま残っている
  await expect(page.getByTestId(`folder-drop-target-${FOLDERS[2].id}`)).toBeVisible();
});

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
  await expect(page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[0].id}`)).toHaveAttribute(
    'aria-label',
    '並び替え・フォルダ移動',
  );
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

test('pendingカードは並び替え対象外のまま、表示中も既存カード同士をDnDソートできる', async ({
  page,
}) => {
  await setupMocks(page);

  let finishCreate!: () => void;
  await page.route(
    (url) => url.pathname === '/api/bookmarks',
    async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }

      await new Promise<void>((resolve) => {
        finishCreate = resolve;
      });
      await route.fulfill({
        status: 201,
        json: makeBookmark('bk-created', 'Created', '/folder-a', 0),
      });
    },
  );

  await page.goto('/?folder=/folder-a');
  await page
    .getByPlaceholder('URLを入力してブックマークを追加')
    .fill('https://pending.example.com');
  await page.getByRole('button', { name: '追加' }).click();

  const creationCard = page.getByTestId('bookmark-creation-pending');
  await expect(creationCard).toBeVisible();
  await expect(creationCard.getByRole('button', { name: /並び替え|フォルダ移動/ })).toHaveCount(0);
  await expect(creationCard.locator('[data-testid^="bookmark-drag-handle-"]')).toHaveCount(0);
  await expect(page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[0].id}`)).toBeVisible();
  await expect(page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[1].id}`)).toBeVisible();

  const patchRequest = page.waitForRequest(
    (request) =>
      request.method() === 'PATCH' &&
      /\/api\/bookmarks\/[^/]+\/position$/.test(new URL(request.url()).pathname),
  );

  await dragTo(
    page,
    page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[0].id}`),
    page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[1].id}`),
  );

  const request = await patchRequest;
  const body = (await request.postDataJSON()) as { position: number };

  expect(request.url()).toContain(`/api/bookmarks/${BOOKMARKS[0].id}/position`);
  expect(body.position).toBe(BOOKMARKS[1].position);
  await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText(['Beta', 'Alpha']);
  await expect(creationCard).toBeVisible();

  finishCreate();
});

test('ブックマークを別フォルダへDnD移動すると移動APIが呼ばれる', async ({ page }) => {
  await setupMocks(page);
  await page.setViewportSize({ width: 1280, height: 900 });

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
  // folder-b には元から Delta/Epsilon があるため Alpha は先頭に追加される
  await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText([
    'Alpha',
    'Delta',
    'Epsilon',
  ]);
});

test('展開した親ではなくchild rowへブックマークをドロップできる', async ({ page }) => {
  await setupMocks(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto('/?folder=/folder-a');
  const parentFolder = page.getByTestId(`folder-drop-target-${FOLDERS[0].id}`);
  const childFolder = page.getByTestId(`folder-drop-target-${FOLDERS[2].id}`);
  await parentFolder.locator('button').first().click();
  await expect(childFolder).toBeVisible();

  const patchRequest = page.waitForRequest(
    (req) =>
      req.method() === 'PATCH' && /\/api\/bookmarks\/[^/]+$/.test(new URL(req.url()).pathname),
  );
  const dragHandle = page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[0].id}`);
  const parentBox = await parentFolder.boundingBox();
  const childBox = await childFolder.boundingBox();
  await expect(dragHandle).toBeVisible();
  const handleBox = await dragHandle.boundingBox();
  if (!parentBox || !childBox || !handleBox) {
    throw new Error('boundingBox が取得できませんでした');
  }

  // Bookmark drop geometry is row-only even though the sortable parent wrapper includes children.
  expect(parentBox.y + parentBox.height).toBeLessThanOrEqual(childBox.y);

  const fx = handleBox.x + handleBox.width / 2;
  const fy = handleBox.y + handleBox.height / 2;
  const tx = childBox.x + childBox.width / 2;
  const ty = childBox.y + childBox.height / 2;
  await page.mouse.move(fx, fy);
  await page.mouse.down();
  await page.mouse.move(fx + 8, fy, { steps: 4 });
  // 補間経路で親の展開 button を横切ると pointer down 中の toggle と競合するため、child へ直接移動する。
  await page.mouse.move(tx, ty);

  await expect(childFolder).toHaveClass(/ring/);
  await expect(parentFolder).not.toHaveClass(/ring/);
  await page.mouse.up();

  const req = await patchRequest;
  const body = (await req.postDataJSON()) as { folderPath: string | null };
  expect(body.folderPath).toBe('/folder-a/child');
  await page.goto('/?folder=/folder-a');
  await expect(page.locator('h3', { hasText: 'Alpha' })).toBeHidden();
});

test('ポインタが外側でもカード中心が入ったフォルダをハイライトして移動できる', async ({ page }) => {
  await setupMocks(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?folder=/folder-a');
  await expect(page.locator('h3', { hasText: 'Alpha' })).toBeVisible();

  const patchRequest = page.waitForRequest(
    (req) =>
      req.method() === 'PATCH' && /\/api\/bookmarks\/[^/]+$/.test(new URL(req.url()).pathname),
  );
  const dragHandle = page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[0].id}`);
  const draggedCard = page.getByTestId(`bookmark-card-${BOOKMARKS[0].id}`);
  const targetFolder = page.getByTestId(`folder-drop-target-${FOLDERS[1].id}`); // Folder B
  const otherFolder = page.getByTestId(`folder-drop-target-${FOLDERS[0].id}`); // Folder A

  await dragHandle.waitFor();
  await draggedCard.waitFor();
  await targetFolder.waitFor();
  await otherFolder.waitFor();

  const handleBox = await dragHandle.boundingBox();
  const cardBox = await draggedCard.boundingBox();
  const targetBox = await targetFolder.boundingBox();
  if (!handleBox || !cardBox || !targetBox) {
    throw new Error('boundingBox が取得できませんでした');
  }

  const fx = handleBox.x + handleBox.width / 2;
  const fy = handleBox.y + handleBox.height / 2;
  const cardCenterX = cardBox.x + cardBox.width / 2;
  const cardCenterY = cardBox.y + cardBox.height / 2;

  // Grab offset を保ったまま、カード中心だけを Folder B の右端から十分内側へ入れる。
  // 右上 handle から掴んでいるため、pointer 自体は folder row の右外側に残る。
  const targetRight = targetBox.x + targetBox.width;
  const insideMargin = Math.min(12, targetBox.width / 4);
  const desiredCardCenterX = targetRight - insideMargin;
  const desiredCardCenterY = targetBox.y + targetBox.height / 2;
  const tx = desiredCardCenterX + (fx - cardCenterX);
  const ty = desiredCardCenterY + (fy - cardCenterY);
  const translatedCardCenterX = cardCenterX + (tx - fx);
  const translatedCardCenterY = cardCenterY + (ty - fy);

  expect(tx).toBeGreaterThan(targetRight);
  expect(translatedCardCenterX).toBeGreaterThan(targetBox.x);
  expect(translatedCardCenterX).toBeLessThan(targetRight);
  expect(translatedCardCenterY).toBeGreaterThan(targetBox.y);
  expect(translatedCardCenterY).toBeLessThan(targetBox.y + targetBox.height);

  // ドラッグ開始 → センサー起動（5px 以上移動）
  await page.mouse.move(fx, fy);
  await page.mouse.down();
  await page.mouse.move(fx + 8, fy, { steps: 4 });
  // カード中心をターゲットフォルダへ移動する。
  await page.mouse.move(tx, ty, { steps: 10 });

  await expect(targetFolder).toHaveClass(/ring/);
  await expect(otherFolder).not.toHaveClass(/ring/);

  await page.mouse.up();

  const req = await patchRequest;
  const body = (await req.postDataJSON()) as { folderPath: string | null };
  expect(body.folderPath).toBe('/folder-b');
  await expect(page.locator('h3', { hasText: 'Alpha' })).toBeHidden();
});

test('pointerがsidebarへ入るとoverlayが縮小し、sidebar外へ戻ると復帰する', async ({ page }) => {
  await setupMocks(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?folder=/folder-a');
  await expect(page.locator('h3', { hasText: 'Alpha' })).toBeVisible();

  const patchRequest = page.waitForRequest(
    (req) =>
      req.method() === 'PATCH' && /\/api\/bookmarks\/[^/]+$/.test(new URL(req.url()).pathname),
  );
  const dragHandle = page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[0].id}`);
  const targetFolder = page.getByTestId(`folder-drop-target-${FOLDERS[1].id}`);
  const sidebar = page.locator('aside');
  const handleBox = await dragHandle.boundingBox();
  const targetBox = await targetFolder.boundingBox();
  const sidebarBox = await sidebar.boundingBox();
  if (!handleBox || !targetBox || !sidebarBox) {
    throw new Error('boundingBox が取得できませんでした');
  }

  const fx = handleBox.x + handleBox.width / 2;
  const fy = handleBox.y + handleBox.height / 2;
  const sidebarX = sidebarBox.x + sidebarBox.width - 8;
  const sidebarY = sidebarBox.y + sidebarBox.height / 2;
  const targetX = targetBox.x + targetBox.width / 2;
  const targetY = targetBox.y + targetBox.height / 2;

  await page.mouse.move(fx, fy);
  await page.mouse.down();
  await page.mouse.move(fx + 8, fy, { steps: 4 });
  const overlayCard = page.getByTestId('bookmark-drag-overlay-card');
  await expect(overlayCard).toHaveCSS('scale', '1');

  await page.mouse.move(sidebarX, sidebarY, { steps: 10 });
  await expect(overlayCard).toHaveCSS('scale', '0.55');

  await page.mouse.move(fx, fy, { steps: 10 });
  await expect(overlayCard).toHaveCSS('scale', '1');

  await page.mouse.move(targetX, targetY, { steps: 10 });
  await expect(targetFolder).toHaveClass(/ring/);
  await expect(overlayCard).toHaveClass(/scale-\[0\.55\]/);
  await page.mouse.up();

  const req = await patchRequest;
  const body = (await req.postDataJSON()) as { folderPath: string | null };
  expect(body.folderPath).toBe('/folder-b');
});

test('ポインタとカード中心が外側でもカードが重なるフォルダへ移動できる', async ({ page }) => {
  await setupMocks(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?folder=/folder-a');
  await expect(page.locator('h3', { hasText: 'Alpha' })).toBeVisible();

  const patchRequest = page.waitForRequest(
    (req) =>
      req.method() === 'PATCH' && /\/api\/bookmarks\/[^/]+$/.test(new URL(req.url()).pathname),
  );
  const dragHandle = page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[0].id}`);
  const draggedCard = page.getByTestId(`bookmark-card-${BOOKMARKS[0].id}`);
  const targetFolder = page.getByTestId(`folder-drop-target-${FOLDERS[1].id}`); // Folder B
  const otherFolder = page.getByTestId(`folder-drop-target-${FOLDERS[0].id}`); // Folder A

  await dragHandle.waitFor();
  await draggedCard.waitFor();
  await targetFolder.waitFor();
  await otherFolder.waitFor();

  const handleBox = await dragHandle.boundingBox();
  const cardBox = await draggedCard.boundingBox();
  const targetBox = await targetFolder.boundingBox();
  if (!handleBox || !cardBox || !targetBox) {
    throw new Error('boundingBox が取得できませんでした');
  }

  const fx = handleBox.x + handleBox.width / 2;
  const fy = handleBox.y + handleBox.height / 2;
  const cardCenterX = cardBox.x + cardBox.width / 2;
  const cardCenterY = cardBox.y + cardBox.height / 2;

  // Card center と pointer は row の右外側に残し、card の左側だけを Folder B に重ねる。
  const desiredCardCenterX = targetBox.x + targetBox.width + 12;
  const desiredCardCenterY = targetBox.y + targetBox.height / 2;
  const tx = desiredCardCenterX + (fx - cardCenterX);
  const ty = desiredCardCenterY + (fy - cardCenterY);
  const translatedCardCenterX = cardCenterX + (tx - fx);
  const translatedCardLeft = cardBox.x + (tx - fx);

  expect(tx).toBeGreaterThan(targetBox.x + targetBox.width);
  expect(translatedCardCenterX).toBeGreaterThan(targetBox.x + targetBox.width);
  expect(translatedCardLeft).toBeLessThan(targetBox.x + targetBox.width);

  await page.mouse.move(fx, fy);
  await page.mouse.down();
  await page.mouse.move(fx + 8, fy, { steps: 4 });
  await page.mouse.move(tx, ty, { steps: 10 });

  await expect(targetFolder).toHaveClass(/ring/);
  await expect(otherFolder).not.toHaveClass(/ring/);

  await page.mouse.up();

  const req = await patchRequest;
  const body = (await req.postDataJSON()) as { folderPath: string | null };
  expect(body.folderPath).toBe('/folder-b');
  await expect(page.locator('h3', { hasText: 'Alpha' })).toBeHidden();
});

test('すべて表示ではフォルダ移動handleから移動できる', async ({ page }) => {
  await setupMocks(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  const patchRequest = page.waitForRequest(
    (req) =>
      req.method() === 'PATCH' && /\/api\/bookmarks\/[^/]+$/.test(new URL(req.url()).pathname),
  );

  await page.goto('/');
  await expect(page.locator('h3', { hasText: 'Alpha' })).toBeVisible();
  const moveHandle = page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[0].id}`);
  await expect(moveHandle).toBeVisible();
  await expect(moveHandle).toHaveAttribute('aria-label', 'フォルダ移動');

  await dragTo(page, moveHandle, page.getByTestId(`folder-drop-target-${FOLDERS[1].id}`));

  const req = await patchRequest;
  const body = (await req.postDataJSON()) as { folderPath: string | null };

  expect(req.url()).toContain(`/api/bookmarks/${BOOKMARKS[0].id}`);
  expect(body.folderPath).toBe('/folder-b');

  await page.goto('/?folder=/folder-b');
  // folder-b には元から Delta/Epsilon があるため Alpha は先頭に追加される
  await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText([
    'Alpha',
    'Delta',
    'Epsilon',
  ]);
});

test('1件だけのフォルダでもhandleから別フォルダへ移動できる', async ({ page }) => {
  const onlyBookmark = makeBookmark('only-bookmark', 'Only', '/single-folder', 0);
  await setupMocks(page, [onlyBookmark]);
  await page.setViewportSize({ width: 1280, height: 900 });

  const patchRequest = page.waitForRequest(
    (req) =>
      req.method() === 'PATCH' && /\/api\/bookmarks\/[^/]+$/.test(new URL(req.url()).pathname),
  );
  await page.goto('/?folder=/single-folder');
  await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText(['Only']);

  const moveHandle = page.getByTestId(`bookmark-drag-handle-${onlyBookmark.id}`);
  await expect(moveHandle).toBeVisible();
  await expect(moveHandle).toHaveAttribute('aria-label', 'フォルダ移動');
  await dragTo(page, moveHandle, page.getByTestId(`folder-drop-target-${FOLDERS[1].id}`));

  const request = await patchRequest;
  const body = (await request.postDataJSON()) as { folderPath: string | null };
  expect(request.url()).toContain(`/api/bookmarks/${onlyBookmark.id}`);
  expect(body.folderPath).toBe('/folder-b');
  await expect(page.locator('h3', { hasText: 'Only' })).toBeHidden();
});

test('mobileでもカード全体ではなくhandleからdragを開始する', async ({ page }) => {
  await setupMocks(page);
  await page.goto('/');

  const card = page.getByTestId(`bookmark-card-${BOOKMARKS[0].id}`);
  const draggableNode = card.locator('..').locator('..');
  const moveHandle = page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[0].id}`);
  await expect(moveHandle).toBeVisible();
  await expect(moveHandle).toHaveAttribute('aria-label', 'フォルダ移動');
  await expect(draggableNode).not.toHaveAttribute('aria-describedby', /.+/);

  const handleBox = await moveHandle.boundingBox();
  if (!handleBox) throw new Error('boundingBox が取得できませんでした');
  const x = handleBox.x + handleBox.width / 2;
  const y = handleBox.y + handleBox.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 8, y, { steps: 4 });
  await expect(page.getByTestId('bookmark-drag-overlay-card')).toBeVisible();
  await page.mouse.up();
});

test('末端フォルダでincludeSubfolders=trueでもdrag handleが表示されDnDソートができる', async ({
  page,
}) => {
  await setupMocks(page);

  await page.goto('/settings');
  await page.getByLabel('サブフォルダを含む').check();

  const patchRequest = page.waitForRequest(
    (req) => req.method() === 'PATCH' && req.url().includes('/position'),
  );

  // folder-b はサブフォルダを持たない末端フォルダ
  await page.goto('/?folder=/folder-b');
  await expect(page.locator('h3', { hasText: 'Delta' })).toBeVisible();
  await expect(page.locator('h3', { hasText: 'Epsilon' })).toBeVisible();

  // drag handle が表示されていること
  await expect(page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[3].id}`)).toBeVisible();
  await expect(page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[4].id}`)).toBeVisible();

  await dragTo(
    page,
    page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[3].id}`),
    page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[4].id}`),
  );

  const req = await patchRequest;
  expect(req.url()).toContain(`/api/bookmarks/${BOOKMARKS[3].id}/position`);
  await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText(['Epsilon', 'Delta']);
});

test('includeSubfolders=true で複数フォルダ混在キャッシュでも同一フォルダのブックマークのみ表示・ソートできる', async ({
  page,
}) => {
  // /gap-folder に bk-1(pos=0), bk-2(pos=1)
  // /gap-folder/sub に bk-x(pos=0), bk-y(pos=1) ← position が重複
  // FOLDERS にはサブフォルダが含まれないため hasSubfolders=false → canReorderBookmarks=true
  // deep=true のキャッシュには 4 件が混在するが、SortableContext には同一フォルダ 2 件のみ渡すべき
  const bk1 = makeBookmark('bk-gap-1', 'GapA', '/gap-folder', 0);
  const bk2 = makeBookmark('bk-gap-2', 'GapB', '/gap-folder', 1);
  const bkX = makeBookmark('bk-gap-x', 'GapX', '/gap-folder/sub', 0);
  const bkY = makeBookmark('bk-gap-y', 'GapY', '/gap-folder/sub', 1);
  await setupMocks(page, [bk1, bk2, bkX, bkY]);

  await page.goto('/settings');
  await page.getByLabel('サブフォルダを含む').check();

  await page.goto('/?folder=/gap-folder');

  // 同一フォルダのブックマークのみ表示される（GapX/GapY は /gap-folder/sub なので表示されない）
  await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText(['GapA', 'GapB']);

  // drag handle が表示される
  await expect(page.getByTestId(`bookmark-drag-handle-${bk1.id}`)).toBeVisible();

  // GapA → GapB の位置にドラッグ → 正しく入れ替わる
  await dragTo(
    page,
    page.getByTestId(`bookmark-drag-handle-${bk1.id}`),
    page.getByTestId(`bookmark-drag-handle-${bk2.id}`),
  );

  await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText(['GapB', 'GapA']);
});

test('deep表示ではフォルダ移動handleをbookmarkソートに使わない', async ({ page }) => {
  await setupMocks(page);

  await page.goto('/settings');
  await page.getByLabel('サブフォルダを含む').check();

  await page.goto('/?folder=/folder-a');
  await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText([
    'Alpha',
    'Gamma',
    'Beta',
  ]);
  const alphaHandle = page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[0].id}`);
  const gammaHandle = page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[2].id}`);
  const betaHandle = page.getByTestId(`bookmark-drag-handle-${BOOKMARKS[1].id}`);
  await expect(alphaHandle).toHaveAttribute('aria-label', 'フォルダ移動');
  await expect(gammaHandle).toHaveAttribute('aria-label', 'フォルダ移動');

  const bookmarkPatchRequests: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'PATCH' && new URL(req.url()).pathname.startsWith('/api/bookmarks')) {
      bookmarkPatchRequests.push(req.url());
    }
  });

  await dragTo(page, alphaHandle, gammaHandle);
  await dragTo(page, alphaHandle, betaHandle);

  expect(bookmarkPatchRequests).toEqual([]);
  await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText([
    'Alpha',
    'Gamma',
    'Beta',
  ]);
});

// ---- ソートずれ回帰テスト: フォルダ内3件の様々なパターン ----
// deep=false（デフォルト）で A,B,C の3件をソートする全パターンを検証する。
// 「意図より1〜2件ずれる」症状が残っていれば以下のいずれかが失敗する。

test.describe('フォルダ内3件ソート（deep=false）全パターン', () => {
  async function setup3Bookmarks(page: Parameters<typeof setupMocks>[0]) {
    const bk1 = makeBookmark('sort-a', 'SortA', '/sort-folder', 0);
    const bk2 = makeBookmark('sort-b', 'SortB', '/sort-folder', 1);
    const bk3 = makeBookmark('sort-c', 'SortC', '/sort-folder', 2);
    await setupMocks(page, [bk1, bk2, bk3]);
    await page.goto('/?folder=/sort-folder');
    await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText([
      'SortA',
      'SortB',
      'SortC',
    ]);
    return { bk1, bk2, bk3 };
  }

  test('1番目を3番目の位置へ移動すると B,C,A になる', async ({ page }) => {
    const { bk1, bk3 } = await setup3Bookmarks(page);
    await dragTo(
      page,
      page.getByTestId(`bookmark-drag-handle-${bk1.id}`),
      page.getByTestId(`bookmark-drag-handle-${bk3.id}`),
    );
    await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText([
      'SortB',
      'SortC',
      'SortA',
    ]);
  });

  test('3番目を1番目の位置へ移動すると C,A,B になる', async ({ page }) => {
    const { bk1, bk3 } = await setup3Bookmarks(page);
    await dragTo(
      page,
      page.getByTestId(`bookmark-drag-handle-${bk3.id}`),
      page.getByTestId(`bookmark-drag-handle-${bk1.id}`),
    );
    await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText([
      'SortC',
      'SortA',
      'SortB',
    ]);
  });

  test('1番目を2番目の位置へ移動すると B,A,C になる', async ({ page }) => {
    const { bk1, bk2 } = await setup3Bookmarks(page);
    await dragTo(
      page,
      page.getByTestId(`bookmark-drag-handle-${bk1.id}`),
      page.getByTestId(`bookmark-drag-handle-${bk2.id}`),
    );
    await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText([
      'SortB',
      'SortA',
      'SortC',
    ]);
  });

  test('2番目を1番目の位置へ移動すると B,A,C になる', async ({ page }) => {
    const { bk1, bk2 } = await setup3Bookmarks(page);
    await dragTo(
      page,
      page.getByTestId(`bookmark-drag-handle-${bk2.id}`),
      page.getByTestId(`bookmark-drag-handle-${bk1.id}`),
    );
    await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText([
      'SortB',
      'SortA',
      'SortC',
    ]);
  });

  test('2番目を3番目の位置へ移動すると A,C,B になる', async ({ page }) => {
    const { bk2, bk3 } = await setup3Bookmarks(page);
    await dragTo(
      page,
      page.getByTestId(`bookmark-drag-handle-${bk2.id}`),
      page.getByTestId(`bookmark-drag-handle-${bk3.id}`),
    );
    await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText([
      'SortA',
      'SortC',
      'SortB',
    ]);
  });

  test('3番目を2番目の位置へ移動すると A,C,B になる', async ({ page }) => {
    const { bk2, bk3 } = await setup3Bookmarks(page);
    await dragTo(
      page,
      page.getByTestId(`bookmark-drag-handle-${bk3.id}`),
      page.getByTestId(`bookmark-drag-handle-${bk2.id}`),
    );
    await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText([
      'SortA',
      'SortC',
      'SortB',
    ]);
  });

  test('連続ソート: 1→3移動後にさらに2番目を1番目に移動', async ({ page }) => {
    const { bk1, bk2, bk3 } = await setup3Bookmarks(page);
    // 1回目: A→C で B,C,A
    const firstPatch = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().includes(`/api/bookmarks/${bk1.id}/position`),
    );
    await dragTo(
      page,
      page.getByTestId(`bookmark-drag-handle-${bk1.id}`),
      page.getByTestId(`bookmark-drag-handle-${bk3.id}`),
    );
    await firstPatch;
    await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText([
      'SortB',
      'SortC',
      'SortA',
    ]);
    // 2回目: C→B で C,B,A
    await dragTo(
      page,
      page.getByTestId(`bookmark-drag-handle-${bk3.id}`),
      page.getByTestId(`bookmark-drag-handle-${bk2.id}`),
    );
    await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText([
      'SortC',
      'SortB',
      'SortA',
    ]);
  });
});

// deep=true かつ混在キャッシュ状態での同一フォルダ内ソート全パターン
test.describe('フォルダ内3件ソート（deep=true 混在キャッシュ）全パターン', () => {
  async function setup3BookmarksMixed(page: Parameters<typeof setupMocks>[0]) {
    const bk1 = makeBookmark('mix-a', 'MixA', '/mix-folder', 0);
    const bk2 = makeBookmark('mix-b', 'MixB', '/mix-folder', 1);
    const bk3 = makeBookmark('mix-c', 'MixC', '/mix-folder', 2);
    // サブフォルダのブックマーク（position が重複）
    const bkX = makeBookmark('mix-x', 'MixX', '/mix-folder/sub', 0);
    const bkY = makeBookmark('mix-y', 'MixY', '/mix-folder/sub', 1);
    const bkZ = makeBookmark('mix-z', 'MixZ', '/mix-folder/sub', 2);
    await setupMocks(page, [bk1, bk2, bk3, bkX, bkY, bkZ]);
    await page.goto('/settings');
    await page.getByLabel('サブフォルダを含む').check();
    await page.goto('/?folder=/mix-folder');
    // FOLDERS にサブフォルダが含まれないため hasSubfolders=false → ソート可能
    // 同一フォルダのブックマークのみ表示される
    await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText([
      'MixA',
      'MixB',
      'MixC',
    ]);
    return { bk1, bk2, bk3 };
  }

  test('1番目を3番目の位置へ移動すると B,C,A になる', async ({ page }) => {
    const { bk1, bk3 } = await setup3BookmarksMixed(page);
    await dragTo(
      page,
      page.getByTestId(`bookmark-drag-handle-${bk1.id}`),
      page.getByTestId(`bookmark-drag-handle-${bk3.id}`),
    );
    await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText([
      'MixB',
      'MixC',
      'MixA',
    ]);
  });

  test('3番目を1番目の位置へ移動すると C,A,B になる', async ({ page }) => {
    const { bk1, bk3 } = await setup3BookmarksMixed(page);
    await dragTo(
      page,
      page.getByTestId(`bookmark-drag-handle-${bk3.id}`),
      page.getByTestId(`bookmark-drag-handle-${bk1.id}`),
    );
    await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText([
      'MixC',
      'MixA',
      'MixB',
    ]);
  });

  test('隣同士の入れ替えが正しく動く', async ({ page }) => {
    const { bk1, bk2 } = await setup3BookmarksMixed(page);
    await dragTo(
      page,
      page.getByTestId(`bookmark-drag-handle-${bk1.id}`),
      page.getByTestId(`bookmark-drag-handle-${bk2.id}`),
    );
    await expect(page.locator('[data-testid^="bookmark-card-"] h3')).toHaveText([
      'MixB',
      'MixA',
      'MixC',
    ]);
  });
});
