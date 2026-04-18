import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../test/render';

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
    renderWithProviders({ initialUrl: '/login' });

    await waitFor(() => {
      expect(screen.getByText('こちら')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('こちら'));

    expect(screen.getByRole('button', { name: 'アカウント作成' })).toBeInTheDocument();
  });

  it('ログインモードに戻れる', async () => {
    renderWithProviders({ initialUrl: '/login' });

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
  });
});
