import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // md ブレークポイント未満にすることでドラッグハンドルを常時表示
        viewport: { width: 767, height: 900 },
      },
    },
  ],
  webServer: {
    command: 'pnpm dev --port 5174',
    url: 'http://localhost:5174',
    cwd: __dirname,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
