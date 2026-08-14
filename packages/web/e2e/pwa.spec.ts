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

const pngIcons = [
  { path: '/apple-touch-icon.png', width: 180, height: 180 },
  { path: '/icon-192.png', width: 192, height: 192 },
  { path: '/icon-512.png', width: 512, height: 512 },
];

test.describe('PWA manifest とアイコン', () => {
  test('favicon の参照先と配信が正しい', async ({ page }) => {
    await page.goto('/');
    const favicon = page.locator('link[rel="icon"]');
    await expect(favicon).toHaveAttribute('href', '/favicon.svg');
    await expect(favicon).toHaveAttribute('type', 'image/svg+xml');

    const response = await page.request.get('/favicon.svg');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/svg+xml');
  });

  test('PNG アイコンが正しい寸法で配信される', async ({ page }) => {
    for (const icon of pngIcons) {
      const response = await page.request.get(icon.path);
      expect(response.status(), `${icon.path} が 200 を返すこと`).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');

      const image = await response.body();
      expect(image.subarray(1, 4).toString()).toBe('PNG');
      expect(image.readUInt32BE(16), `${icon.path} の幅`).toBe(icon.width);
      expect(image.readUInt32BE(20), `${icon.path} の高さ`).toBe(icon.height);
    }
  });

  test('index.html に apple-touch-icon リンクがある', async ({ page }) => {
    await page.goto('/');
    const appleIcon = page.locator('link[rel="apple-touch-icon"]');
    await expect(appleIcon).toHaveAttribute('href', '/apple-touch-icon.png');
    await expect(appleIcon).toHaveAttribute('sizes', '180x180');
  });

  test('manifest.webmanifest が有効な内容を持つ', async ({ page }) => {
    const response = await page.request.get('/manifest.webmanifest');
    expect(response.status()).toBe(200);

    const manifest = (await response.json()) as Record<string, unknown>;
    expect(manifest.name).toBe('bkmk');
    expect(manifest.display).toBe('standalone');
    expect(Array.isArray(manifest.icons)).toBe(true);

    const icons = manifest.icons as Array<{ src: string; sizes: string }>;
    const sizes = icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });
});

test.describe('PWA ナビゲーションフォールバック', () => {
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
    await expect(page.getByRole('heading', { name: 'メールアドレスの確認' })).toBeVisible();
  });
});
