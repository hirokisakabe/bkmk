import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockBookmarks } from '../test/handlers';
import { renderWithProviders } from '../test/render';

describe('IndexPage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it('検索語を300msデバウンスしてURLと検索結果へ反映し、入力値を維持する', async () => {
    const { router } = renderWithProviders({ initialUrl: '/' });

    const searchInput = await screen.findByRole('textbox', { name: 'ブックマークを検索' });
    vi.useFakeTimers();
    fireEvent.change(searchInput, { target: { value: 'TypeScript' } });

    act(() => vi.advanceTimersByTime(299));
    expect(router.state.location.search).toEqual({});

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(router.state.location.search).toEqual({ q: 'TypeScript' });
      expect(screen.getByRole('heading', { name: '「TypeScript」の検索結果' })).toBeInTheDocument();
    });
    expect(screen.getByRole('textbox', { name: 'ブックマークを検索' })).toHaveValue('TypeScript');
  });

  it('古いURL遷移が完了しても、その後に入力した新しい検索語を上書きしない', async () => {
    const { router } = renderWithProviders({ initialUrl: '/' });
    const searchInput = await screen.findByRole('textbox', { name: 'ブックマークを検索' });

    vi.useFakeTimers();
    fireEvent.change(searchInput, { target: { value: 'old' } });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.change(searchInput, { target: { value: 'new' } });
    await act(async () => Promise.resolve());

    expect(searchInput).toHaveValue('new');

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });
    vi.useRealTimers();
    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'new' }));
    expect(searchInput).toHaveValue('new');
  });

  it('履歴移動でURLから入力値を同期し、移動前の古いタイマーを実行しない', async () => {
    const { router } = renderWithProviders({ initialUrl: '/?q=previous' });

    const searchInput = await screen.findByRole('textbox', { name: 'ブックマークを検索' });
    await act(async () => {
      await router.navigate({ to: '/', search: { q: 'current' } });
    });
    await waitFor(() => expect(searchInput).toHaveValue('current'));

    vi.useFakeTimers();
    fireEvent.change(searchInput, { target: { value: 'stale' } });
    act(() => router.history.back());
    await act(async () => Promise.resolve());

    expect(router.state.location.search).toEqual({ q: 'previous' });
    expect(searchInput).toHaveValue('previous');

    act(() => vi.advanceTimersByTime(300));
    await act(async () => Promise.resolve());
    expect(router.state.location.search).toEqual({ q: 'previous' });

    act(() => router.history.forward());
    await act(async () => Promise.resolve());
    expect(router.state.location.search).toEqual({ q: 'current' });
    expect(searchInput).toHaveValue('current');
  });

  it('モバイル上部バーからサイドバーを開かずに検索入力を展開できる', async () => {
    const user = userEvent.setup();
    renderWithProviders({ initialUrl: '/' });

    await user.click(await screen.findByRole('button', { name: '検索を開く' }));

    const mobileSearchInput = screen.getByRole('textbox', {
      name: 'モバイルでブックマークを検索',
    });
    expect(mobileSearchInput).toHaveAttribute('placeholder', 'ブックマークを検索...');
    expect(mobileSearchInput).toHaveFocus();
    expect(mobileSearchInput.parentElement).toHaveClass('min-w-0', 'flex-1');
    expect(mobileSearchInput.parentElement?.parentElement).toHaveClass('md:hidden');
    expect(mobileSearchInput.closest('aside')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'ブックマークを検索' }).parentElement).toHaveClass(
      'hidden',
      'md:block',
    );
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
