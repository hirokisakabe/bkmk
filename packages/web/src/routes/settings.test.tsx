import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../test/render';

const { mockSignOut } = vi.hoisted(() => ({
  mockSignOut: vi.fn().mockResolvedValue({ data: null, error: null }),
}));
vi.mock('../lib/auth-client', () => ({
  authClient: { signOut: mockSignOut },
}));

describe('SettingsPage', () => {
  it('設定画面が表示される', async () => {
    renderWithProviders({ initialUrl: '/settings' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '設定' })).toBeInTheDocument();
    });

    expect(screen.getByText('サブフォルダを含む')).toBeInTheDocument();
  });

  it('サブフォルダを含むトグルを切り替えできる', async () => {
    const user = userEvent.setup();
    renderWithProviders({ initialUrl: '/settings' });

    await waitFor(() => {
      expect(screen.getByText('サブフォルダを含む')).toBeInTheDocument();
    });

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('アカウントセクションにログアウトボタンが表示される', async () => {
    renderWithProviders({ initialUrl: '/settings' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'アカウント' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument();
  });

  it('ログアウトボタンをクリックするとサインアウトしてログインページに遷移する', async () => {
    const user = userEvent.setup();
    mockSignOut.mockClear();

    const { router } = renderWithProviders({ initialUrl: '/settings' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'ログアウト' }));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
  });
});
