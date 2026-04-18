import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../test/render';

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
});
