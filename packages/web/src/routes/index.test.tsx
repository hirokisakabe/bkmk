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

  it('削除ボタンをクリックすると確認ダイアログが表示される', async () => {
    const user = userEvent.setup();
    renderWithProviders({ initialUrl: '/' });

    await waitFor(() => {
      expect(screen.getByText(mockBookmarks[0].title!)).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button', { name: '削除' });
    await user.click(deleteButtons[0]);

    expect(screen.getByText('ブックマークを削除')).toBeInTheDocument();
    expect(
      screen.getByText(
        `「${mockBookmarks[0].title}」をゴミ箱に移動します。ゴミ箱から復元できます。`,
      ),
    ).toBeInTheDocument();
  });

  it('確認ダイアログでキャンセルするとダイアログが閉じる', async () => {
    const user = userEvent.setup();
    renderWithProviders({ initialUrl: '/' });

    await waitFor(() => {
      expect(screen.getByText(mockBookmarks[0].title!)).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button', { name: '削除' });
    await user.click(deleteButtons[0]);

    expect(screen.getByText('ブックマークを削除')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    await waitFor(() => {
      expect(screen.queryByText('ブックマークを削除')).not.toBeInTheDocument();
    });
  });

  it('確認ダイアログで削除を実行するとダイアログが閉じる', async () => {
    const user = userEvent.setup();
    renderWithProviders({ initialUrl: '/' });

    await waitFor(() => {
      expect(screen.getByText(mockBookmarks[0].title!)).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button', { name: '削除' });
    await user.click(deleteButtons[0]);

    expect(screen.getByText('ブックマークを削除')).toBeInTheDocument();

    // ダイアログ内の削除ボタン
    const dialogButtons = screen.getAllByRole('button', { name: '削除' });
    const dialogDeleteButton = dialogButtons.find(
      (btn) => btn.closest('[role="alertdialog"]') !== null,
    );
    await user.click(dialogDeleteButton!);

    await waitFor(() => {
      expect(screen.queryByText('ブックマークを削除')).not.toBeInTheDocument();
    });
  });
});
