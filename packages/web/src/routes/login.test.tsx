import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../test/render';

const authMocks = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
}));

vi.mock('../lib/auth-client', () => ({
  authClient: {
    signIn: { email: authMocks.signInEmail },
    signUp: { email: authMocks.signUpEmail },
  },
}));

describe('LoginPage', () => {
  it('ログインフォームが表示される', async () => {
    renderWithProviders({ initialUrl: '/login' });

    await waitFor(() => {
      expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('パスワード')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument();
  });

  it('アカウント作成モードに切り替えられる', async () => {
    const { router } = renderWithProviders({ initialUrl: '/login' });

    await waitFor(() => {
      expect(screen.getByText('こちら')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('こちら'));

    expect(screen.getByRole('button', { name: 'アカウント作成' })).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ mode: 'signup' });
  });

  it('mode=signupの場合はアカウント作成フォームを初期表示する', async () => {
    renderWithProviders({ initialUrl: '/login?mode=signup' });

    expect(await screen.findByRole('button', { name: 'アカウント作成' })).toBeInTheDocument();
  });

  it('ログインモードに戻れる', async () => {
    const { router } = renderWithProviders({ initialUrl: '/login' });

    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('こちら')).toBeInTheDocument();
    });

    // アカウント作成モードに切り替え
    await user.click(screen.getByText('こちら'));
    expect(screen.getByRole('button', { name: 'アカウント作成' })).toBeInTheDocument();

    // ログインモードに戻す
    await user.click(screen.getByText('こちら'));
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument();
    expect(router.state.location.search).toEqual({});
  });

  it('登録後に確認メールの案内を表示する', async () => {
    authMocks.signUpEmail.mockResolvedValue({
      data: {
        token: null,
        user: {
          id: 'new-user',
          email: 'new@example.com',
          emailVerified: false,
          name: 'new@example.com',
        },
      },
      error: null,
    });
    renderWithProviders({ initialUrl: '/login?mode=signup' });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('メールアドレス'), 'new@example.com');
    await user.type(screen.getByLabelText('パスワード'), 'password1234');
    await user.click(screen.getByRole('button', { name: 'アカウント作成' }));

    expect(await screen.findByText('確認メールをご確認ください')).toBeInTheDocument();
    expect(screen.getByText(/new@example.com に確認メールを送りました/)).toBeInTheDocument();
  });

  it('未確認ログイン時に再送と次の操作を案内する', async () => {
    authMocks.signInEmail.mockResolvedValue({
      data: null,
      error: { code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified' },
    });
    renderWithProviders({ initialUrl: '/login' });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('メールアドレス'), 'waiting@example.com');
    await user.type(screen.getByLabelText('パスワード'), 'password1234');
    await user.click(screen.getByRole('button', { name: 'ログイン' }));

    expect(await screen.findByText(/確認メールを再送しました/)).toBeInTheDocument();
    expect(screen.getByText(/リンクを開いてから、もう一度ログイン/)).toBeInTheDocument();
  });
});
