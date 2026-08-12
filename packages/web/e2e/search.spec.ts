import { expect, test } from '@playwright/test';

import { setupMocks } from './helpers';

test('モバイル上部バーの検索ボタンから入力欄を表示してフォーカスできる', async ({ page }) => {
  await setupMocks(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const desktopSearch = page.getByRole('textbox', { name: 'ブックマークを検索', exact: true });
  await expect(desktopSearch).toBeHidden();

  await page.getByRole('button', { name: '検索を開く' }).click();

  const mobileSearch = page.getByRole('textbox', { name: 'モバイルでブックマークを検索' });
  await expect(mobileSearch).toBeVisible();
  await expect(mobileSearch).toBeFocused();
  await expect(mobileSearch).toBeInViewport();
});
