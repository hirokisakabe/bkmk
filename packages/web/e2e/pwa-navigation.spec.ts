import { expect, test } from '@playwright/test';

async function activateServiceWorker(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;

    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        });
      });
    }
  });
}

test('認証・API・ヘルスチェックへのナビゲーションはネットワークへ到達する', async ({ page }) => {
  await activateServiceWorker(page);

  for (const path of [
    '/auth/verify-email?token=test',
    '/auth?probe=test',
    '/api/test',
    '/api?probe=test',
    '/health',
    '/health?probe=test',
  ]) {
    const marker = `network:${path}`;
    await page.route(path, (route) =>
      route.fulfill({
        contentType: 'text/plain',
        body: marker,
      }),
    );

    await page.goto(path);
    await expect(page.locator('body')).toHaveText(marker);
  }
});

test('通常の SPA ルートはオフラインでもナビゲーションフォールバックされる', async ({
  context,
  page,
}) => {
  await activateServiceWorker(page);
  await context.setOffline(true);

  await page.goto('/verify-email');
  await expect(page).toHaveURL(/\/login\?verified=true$/);
  await expect(
    page.getByText('メールアドレスを確認しました。ログインしてください。'),
  ).toBeVisible();
});
