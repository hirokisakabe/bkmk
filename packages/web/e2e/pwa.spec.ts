import { expect, test } from '@playwright/test';

test.describe('PWA manifest とアイコン', () => {
  test('アイコンファイルが存在する', async ({ page }) => {
    for (const path of ['/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']) {
      const response = await page.request.get(path);
      expect(response.status(), `${path} が 200 を返すこと`).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
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
