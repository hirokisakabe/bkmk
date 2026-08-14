import { expect, test, type Page } from '@playwright/test';

async function mockGuest(page: Page) {
  await page.route(
    (url) => url.pathname.includes('/auth/get-session'),
    (route) => route.fulfill({ json: null }),
  );
}

test('登録後のメール確認と未確認ログインの再送案内を表示する', async ({ page }) => {
  await mockGuest(page);
  await page.route(
    (url) => url.pathname.endsWith('/auth/sign-up/email'),
    (route) =>
      route.fulfill({
        json: {
          token: null,
          user: {
            id: 'new-user',
            email: 'new@example.com',
            emailVerified: false,
            name: 'new@example.com',
          },
        },
      }),
  );
  await page.goto('/login?mode=signup');
  await page.getByLabel('メールアドレス').fill('new@example.com');
  await page.getByLabel('パスワード').fill('password1234');
  await page.getByRole('button', { name: 'アカウント作成' }).click();
  await expect(page.getByText('アカウント作成を受け付けました')).toBeVisible();

  await page.getByRole('button', { name: 'ログイン画面へ戻る' }).click();
  await page.route(
    (url) => url.pathname.endsWith('/auth/sign-in/email'),
    (route) =>
      route.fulfill({
        status: 403,
        json: { code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified' },
      }),
  );
  await page.getByLabel('メールアドレス').fill('new@example.com');
  await page.getByLabel('パスワード').fill('password1234');
  await page.getByRole('button', { name: 'ログイン' }).click();
  await expect(page.getByText(/配送結果は確認できません/)).toBeVisible();
});

test('パスワード再設定要求から新しいパスワードを設定する', async ({ page }) => {
  await mockGuest(page);
  await page.route(
    (url) => url.pathname.endsWith('/auth/request-password-reset'),
    (route) =>
      route.fulfill({
        json: {
          status: true,
          message: 'If this email exists in our system, check your email for the reset link',
        },
      }),
  );
  await page.goto('/forgot-password');
  await page.getByLabel('メールアドレス').fill('unknown@example.com');
  await page.getByRole('button', { name: '再設定メールを送る' }).click();
  await expect(
    page.getByText(/アカウントの登録状況やメールの配送結果は表示しません/),
  ).toBeVisible();

  await page.route(
    (url) => url.pathname.endsWith('/auth/reset-password'),
    (route) => route.fulfill({ json: { status: true } }),
  );
  await page.goto('/reset-password?token=valid-token');
  await page.getByLabel('新しいパスワード', { exact: true }).fill('new-password1234');
  await page.getByLabel('新しいパスワード（確認）').fill('new-password1234');
  await page.getByRole('button', { name: 'パスワードを変更' }).click();
  await expect(page.getByText(/パスワードを変更しました/)).toBeVisible();
});

test('無効な確認・再設定リンクから次の操作へ進める', async ({ page }) => {
  await page.goto('/verify-email?error=INVALID_TOKEN');
  await expect(page.getByText(/確認リンクは無効か、有効期限が切れています/)).toBeVisible();
  await expect(page.getByRole('link', { name: /確認メールを再送/ })).toBeVisible();

  await page.goto('/reset-password?error=INVALID_TOKEN');
  await expect(page.getByText(/再設定リンクは無効か、有効期限が切れています/)).toBeVisible();
  await expect(page.getByRole('link', { name: /再設定メールをもう一度送る/ })).toBeVisible();
});

test('確認成功時は中間画面なしでログイン画面に一度だけ案内する', async ({ page }) => {
  await mockGuest(page);

  await page.goto('/verify-email');

  await expect(page).toHaveURL(/\/login\?verified=true$/);
  await expect(page.getByText('メールアドレスを確認しました。ログインしてください。')).toHaveCount(
    1,
  );
  await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'ログインする' })).toHaveCount(0);

  await page.goto('/login');
  await expect(page.getByText(/メールアドレスを確認しました/)).toHaveCount(0);
});
