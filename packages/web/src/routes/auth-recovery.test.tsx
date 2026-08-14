import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../test/render';

const authMocks = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock('../lib/auth-client', () => ({
  authClient: authMocks,
}));

describe('authentication recovery pages', () => {
  it('パスワード再設定要求後に登録有無を明かさない案内を表示する', async () => {
    authMocks.requestPasswordReset.mockResolvedValue({
      data: {
        status: true,
        message: 'If this email exists in our system, check your email for the reset link',
      },
      error: null,
    });
    renderWithProviders({ initialUrl: '/forgot-password' });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('メールアドレス'), 'unknown@example.com');
    await user.click(screen.getByRole('button', { name: '再設定メールを送る' }));

    expect(
      await screen.findByText(/アカウントの登録状況やメールの配送結果は表示しません/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/登録されていません/)).not.toBeInTheDocument();
  });

  it('パスワード再設定の配送失敗でも中立的な案内を表示する', async () => {
    authMocks.requestPasswordReset.mockResolvedValue({
      data: null,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' },
    });
    renderWithProviders({ initialUrl: '/forgot-password' });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('メールアドレス'), 'known@example.com');
    await user.click(screen.getByRole('button', { name: '再設定メールを送る' }));

    expect(
      await screen.findByText(/アカウントの登録状況やメールの配送結果は表示しません/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/再設定メールを送りました/)).not.toBeInTheDocument();
  });

  it('有効なトークンで新しいパスワードを設定できる', async () => {
    authMocks.resetPassword.mockResolvedValue({ data: { status: true }, error: null });
    renderWithProviders({ initialUrl: '/reset-password?token=valid-token' });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('新しいパスワード'), 'new-password1234');
    await user.type(screen.getByLabelText('新しいパスワード（確認）'), 'new-password1234');
    await user.click(screen.getByRole('button', { name: 'パスワードを変更' }));

    expect(await screen.findByText(/パスワードを変更しました/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ログインする' })).toBeInTheDocument();
  });

  it('無効または期限切れの再設定リンクから再送へ進める', async () => {
    renderWithProviders({ initialUrl: '/reset-password?error=INVALID_TOKEN' });

    expect(await screen.findByText(/無効か、有効期限が切れています/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '再設定メールをもう一度送る' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('確認成功を表示する', async () => {
    renderWithProviders({ initialUrl: '/verify-email' });

    expect(await screen.findByText(/メールアドレスを確認しました/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ログインする' })).toBeInTheDocument();
  });

  it('無効または期限切れの確認リンクから再送手順へ進める', async () => {
    renderWithProviders({ initialUrl: '/verify-email?error=TOKEN_EXPIRED' });

    expect(await screen.findByText(/無効か、有効期限が切れています/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'ログイン画面で確認メールを再送する' }),
    ).toHaveAttribute('href', '/login');
  });
});
