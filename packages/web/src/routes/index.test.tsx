import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockBookmarks } from '../test/handlers';
import { renderWithProviders } from '../test/render';

describe('IndexPage', () => {
  it('「すべて」選択時にフォルダ内含む全ブックマークが表示される', async () => {
    renderWithProviders({ initialUrl: '/' });

    await waitFor(() => {
      expect(screen.getByText(mockBookmarks[0].title!)).toBeInTheDocument();
    });

    expect(screen.getByText(mockBookmarks[1].title!)).toBeInTheDocument();
    expect(screen.getByText(mockBookmarks[2].title!)).toBeInTheDocument();
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

  it('検索バーがサイドバーではなくメイン領域の右上に表示される', async () => {
    renderWithProviders({ initialUrl: '/' });

    const searchInput = await screen.findByRole('textbox', { name: 'ブックマークを検索' });
    expect(searchInput).toHaveAttribute('placeholder', 'ブックマークを検索...');
    expect(searchInput.closest('aside')).not.toBeInTheDocument();
    expect(searchInput.closest('main')).toBeInTheDocument();
    expect(searchInput.parentElement).toHaveClass('float-right', 'max-w-[22rem]');
  });

  it('検索語をデバウンスして検索結果へ遷移し、入力値を維持する', async () => {
    const user = userEvent.setup();
    renderWithProviders({ initialUrl: '/' });

    const searchInput = await screen.findByRole('textbox', { name: 'ブックマークを検索' });
    await user.type(searchInput, 'TypeScript');

    expect(
      screen.queryByRole('heading', { name: '「TypeScript」の検索結果' }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '「TypeScript」の検索結果' })).toBeInTheDocument();
    });
    expect(screen.getByRole('textbox', { name: 'ブックマークを検索' })).toHaveValue('TypeScript');
  });

  it('モバイル上部バーからサイドバーを開かずに検索入力を展開できる', async () => {
    const user = userEvent.setup();
    renderWithProviders({ initialUrl: '/' });

    await user.click(await screen.findByRole('button', { name: '検索を開く' }));

    const mobileSearchInput = screen.getByRole('textbox', {
      name: 'モバイルでブックマークを検索',
    });
    expect(mobileSearchInput).toHaveAttribute('placeholder', 'ブックマークを検索...');
    expect(mobileSearchInput.closest('aside')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'サイドバーを閉じる' }).closest('aside')).toHaveClass(
      '-translate-x-full',
    );
  });

  it('サイドバーに「未分類」ノードが表示される', async () => {
    renderWithProviders({ initialUrl: '/' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '未分類' })).toBeInTheDocument();
    });
  });

  it('「未分類」をクリックするとフォルダ未所属のブックマークのみ表示される', async () => {
    const user = userEvent.setup();
    renderWithProviders({ initialUrl: '/' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '未分類' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '未分類' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '未分類' })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(mockBookmarks[0].title!)).toBeInTheDocument();
    });
    expect(screen.getByText(mockBookmarks[1].title!)).toBeInTheDocument();
    expect(screen.queryByText(mockBookmarks[2].title!)).not.toBeInTheDocument();
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
