import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockBookmarks } from '../test/handlers';
import { renderWithProviders } from '../test/render';

describe('IndexPage', () => {
  it('ブックマーク一覧が表示される', async () => {
    renderWithProviders({ initialUrl: '/' });

    // ブックマークのタイトルが表示されるのを待つ
    await waitFor(() => {
      expect(screen.getByText(mockBookmarks[0].title!)).toBeInTheDocument();
    });

    expect(screen.getByText(mockBookmarks[1].title!)).toBeInTheDocument();
  });

  it('ブックマークのURLが表示される', async () => {
    renderWithProviders({ initialUrl: '/' });

    await waitFor(() => {
      expect(screen.getByText(mockBookmarks[0].url)).toBeInTheDocument();
    });
  });

  it('ブックマーク追加フォームが表示される', async () => {
    renderWithProviders({ initialUrl: '/' });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('URLを入力してブックマークを追加')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: '追加' })).toBeInTheDocument();
  });

  it('フォルダ名「すべて」が見出しに表示される', async () => {
    renderWithProviders({ initialUrl: '/' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'すべて' })).toBeInTheDocument();
    });
  });

  it('削除ボタンをクリックすると確認ダイアログなしで即座にゴミ箱へ移動する', async () => {
    const user = userEvent.setup();
    renderWithProviders({ initialUrl: '/' });

    await waitFor(() => {
      expect(screen.getByText(mockBookmarks[0].title!)).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button', { name: '削除' });
    await user.click(deleteButtons[0]);

    // 確認ダイアログが表示されないことを検証
    expect(screen.queryByText('ブックマークを削除')).not.toBeInTheDocument();
  });
});
