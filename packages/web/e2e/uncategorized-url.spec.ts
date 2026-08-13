import { expect, test } from '@playwright/test';

import { makeBookmark, setupMocks } from './helpers';

test('旧未分類URLを正規化し、フォルダとの遷移で不要なparameterを残さない', async ({ page }) => {
  await setupMocks(page, [makeBookmark('bk-uncategorized', 'Uncategorized', null, 0)]);
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto('/?folder=__uncategorized__');

  await expect(page).toHaveURL('/?view=uncategorized');
  await expect(page.getByRole('heading', { name: '未分類' })).toBeVisible();
  await expect(page.getByRole('button', { name: '未分類' })).toHaveClass(/bg-blue-100/);
  await expect(page.getByRole('heading', { name: 'Uncategorized' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Alpha' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Folder A', exact: true }).click();
  await expect(page).toHaveURL('/?folder=%2Ffolder-a');
  await expect(page.getByRole('heading', { name: 'Alpha' })).toBeVisible();

  await page.getByRole('button', { name: '未分類' }).click();
  await expect(page).toHaveURL('/?view=uncategorized');
  await expect(page.getByRole('heading', { name: 'Uncategorized' })).toBeVisible();
});

test('未分類から検索とすべてへ移動すると不要なparameterを残さない', async ({ page }) => {
  await setupMocks(page, [makeBookmark('bk-uncategorized', 'Uncategorized', null, 0)]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?view=uncategorized');
  await expect(page.getByRole('heading', { name: 'Uncategorized' })).toBeVisible();

  await page
    .getByRole('textbox', { name: 'ブックマークを検索', exact: true })
    .pressSequentially('keyword');
  await expect(page).toHaveURL('/?q=keyword');

  await page.getByRole('button', { name: 'すべて', exact: true }).click();
  await expect(page).toHaveURL('/');
});
