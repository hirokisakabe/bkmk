import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getOptionalSession } from '../lib/auth-guard';
import { mockBookmarks } from '../test/handlers';
import { renderWithProviders } from '../test/render';
import { server } from '../test/server';
import type { Bookmark, Folder } from '../types';

describe('IndexPage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('未ログイン時はランディングページを表示し、ログイン画面へリダイレクトしない', async () => {
    vi.mocked(getOptionalSession).mockResolvedValueOnce({ session: null });

    const { router } = renderWithProviders({ initialUrl: '/' });

    expect(
      await screen.findByRole('heading', { name: '気になったページを、すぐ保存。' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(screen.getByRole('link', { name: '無料でアカウント作成' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'ログイン' }).length).toBeGreaterThan(0);
  });

  it('ログイン済みの場合は既存のブックマーク管理画面を表示する', async () => {
    renderWithProviders({ initialUrl: '/' });

    expect(
      await screen.findByPlaceholderText('URLを入力してブックマークを追加'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Save now. Find later.')).not.toBeInTheDocument();
  });

  it('ランディングページのCTAからログインとアカウント作成へ遷移できる', async () => {
    vi.mocked(getOptionalSession)
      .mockResolvedValueOnce({ session: null })
      .mockResolvedValueOnce({ session: null });
    const user = userEvent.setup();
    const { router } = renderWithProviders({ initialUrl: '/' });

    await user.click(await screen.findByRole('link', { name: '無料でアカウント作成' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
      expect(router.state.location.search).toEqual({ mode: 'signup' });
    });

    await act(async () => {
      await router.navigate({ to: '/', search: {} });
    });
    const [loginLink] = await screen.findAllByRole('link', { name: 'ログイン' });
    await user.click(loginLink);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
      expect(router.state.location.search).toEqual({});
    });
  });

  it('「すべて」選択時にフォルダ内含む全ブックマークが表示される', async () => {
    renderWithProviders({ initialUrl: '/' });

    await waitFor(() => {
      expect(screen.getByText(mockBookmarks[0].title!)).toBeInTheDocument();
    });

    expect(screen.getByText(mockBookmarks[1].title!)).toBeInTheDocument();
    expect(screen.getByText(mockBookmarks[2].title!)).toBeInTheDocument();
  });

  it('「すべて」では未分類、folder tree 順の full path group として表示する', async () => {
    const folders: Folder[] = [
      {
        id: 'personal',
        userId: 'test-user',
        name: 'personal',
        path: '/personal',
        parentPath: null,
        position: 0,
        deletedAt: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'work',
        userId: 'test-user',
        name: 'work',
        path: '/work',
        parentPath: null,
        position: 1,
        deletedAt: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'project',
        userId: 'test-user',
        name: 'project',
        path: '/work/project',
        parentPath: '/work',
        position: 0,
        deletedAt: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    const groupedBookmarks: Bookmark[] = [
      ...mockBookmarks,
      { ...mockBookmarks[2], id: 'personal-bookmark', folderPath: '/personal', position: 0 },
      { ...mockBookmarks[2], id: 'project-bookmark', folderPath: '/work/project', position: 0 },
    ];
    server.use(
      http.get('/api/folders', () => HttpResponse.json(folders)),
      http.get('/api/bookmarks', ({ request }) =>
        new URL(request.url).searchParams.has('limit')
          ? HttpResponse.json({ data: groupedBookmarks, nextCursor: null })
          : HttpResponse.json(groupedBookmarks),
      ),
    );
    renderWithProviders({ initialUrl: '/' });

    const groups = await screen.findByTestId('bookmark-groups');
    const headings = within(groups).getAllByRole('heading', { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      '未分類',
      '/personal',
      '/work',
      '/work/project',
    ]);
    expect(within(screen.getByTestId('bookmark-group-未分類')).getAllByRole('link')).toHaveLength(
      2,
    );
    expect(within(screen.getByTestId('bookmark-group-/work')).getAllByRole('link')).toHaveLength(1);
    expect(
      within(screen.getByTestId('bookmark-group-/work/project')).getAllByRole('link'),
    ).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /折りたた/ })).not.toBeInTheDocument();
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

  it.each([
    ['すべて', '/', 'すべて'],
    ['フォルダ選択', '/?folder=%2Fwork', 'work'],
    ['検索結果', '/?q=TypeScript', '「TypeScript」の検索結果'],
  ])(
    '%sでは見出しと検索バーがメイン領域の同じヘッダー行に表示される',
    async (_, initialUrl, heading) => {
      renderWithProviders({ initialUrl });

      const searchInput = await screen.findByRole('textbox', { name: 'ブックマークを検索' });
      const pageHeading = await screen.findByRole('heading', { name: heading });
      const header = screen.getByTestId('main-header');
      expect(searchInput).toHaveAttribute('placeholder', 'ブックマークを検索...');
      expect(searchInput.closest('aside')).not.toBeInTheDocument();
      expect(searchInput.closest('main')).toBeInTheDocument();
      expect(header).toContainElement(pageHeading);
      expect(header).toContainElement(searchInput);
      expect(header).toHaveClass('mb-6', 'flex', 'min-w-0', 'items-center');
      expect(pageHeading).toHaveClass('min-w-0', 'flex-1');
      expect(pageHeading.querySelector('span')).toHaveClass('block', 'truncate');
      expect(searchInput.parentElement).toHaveClass(
        'max-w-[20rem]',
        'shrink-0',
        'md:mr-6',
        'md:block',
      );
    },
  );

  it('長いフォルダ見出しだけを縮め、pointer と keyboard focus で全文を表示する', async () => {
    const longFolderName = 'LongFolderNameWithoutAnySpaces0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    renderWithProviders({
      initialUrl: `/?folder=${encodeURIComponent(`/${longFolderName}`)}`,
    });

    const heading = await screen.findByRole('heading', { name: longFolderName });
    const headingText = heading.querySelector('span') as HTMLElement;
    const searchInput = screen.getByRole('textbox', { name: 'ブックマークを検索' });
    expect(heading).toHaveClass('min-w-0', 'flex-1');
    expect(headingText).toHaveClass('truncate');
    expect(searchInput.parentElement).toHaveClass('shrink-0', 'max-w-[20rem]');
    markAsOverflowing(headingText);
    await waitFor(() => expect(heading).toHaveAttribute('tabindex', '0'));

    fireEvent.pointerEnter(heading);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(longFolderName);
    fireEvent.pointerLeave(heading);

    heading.focus();
    expect(heading).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(longFolderName);
    expect(heading).not.toHaveAttribute('title');
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
    const navigate = router.navigate.bind(router);
    let releaseOldNavigation!: () => void;
    let finishOldNavigation!: () => void;
    const oldNavigationGate = new Promise<void>((resolve) => {
      releaseOldNavigation = resolve;
    });
    const oldNavigationFinished = new Promise<void>((resolve) => {
      finishOldNavigation = resolve;
    });
    vi.spyOn(router, 'navigate').mockImplementation(async (options) => {
      const search = options.search as { q?: string } | undefined;
      if (search?.q === 'old') {
        await oldNavigationGate;
        await navigate(options);
        finishOldNavigation();
        return;
      }
      return navigate(options);
    });

    vi.useFakeTimers();
    fireEvent.change(searchInput, { target: { value: 'old' } });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.change(searchInput, { target: { value: 'new' } });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });
    vi.useRealTimers();
    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'new' }));

    await act(async () => {
      releaseOldNavigation();
      await oldNavigationFinished;
    });

    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'new' }));
    expect(searchInput).toHaveValue('new');
  });

  it('古い検索遷移が完了しても、その後の通常ルート遷移を上書きしない', async () => {
    const { router } = renderWithProviders({ initialUrl: '/' });
    const searchInput = await screen.findByRole('textbox', { name: 'ブックマークを検索' });
    const navigate = router.navigate.bind(router);
    let releaseOldNavigation!: () => void;
    let finishOldNavigation!: () => void;
    const oldNavigationGate = new Promise<void>((resolve) => {
      releaseOldNavigation = resolve;
    });
    const oldNavigationFinished = new Promise<void>((resolve) => {
      finishOldNavigation = resolve;
    });
    vi.spyOn(router, 'navigate').mockImplementation(async (options) => {
      const search = options.search as { q?: string } | undefined;
      if (search?.q === 'old') {
        await oldNavigationGate;
        await navigate(options);
        finishOldNavigation();
        return;
      }
      return navigate(options);
    });

    vi.useFakeTimers();
    fireEvent.change(searchInput, { target: { value: 'old' } });
    act(() => vi.advanceTimersByTime(300));
    vi.useRealTimers();

    await act(async () => {
      await router.navigate({ to: '/settings' });
    });
    await waitFor(() => expect(router.state.location.pathname).toBe('/settings'));

    await act(async () => {
      releaseOldNavigation();
      await oldNavigationFinished;
    });

    await waitFor(() => expect(router.state.location.pathname).toBe('/settings'));
    expect(router.state.location.search).toEqual({});
  });

  it('検索語が同じまま別の場所へ遷移した場合も保留中の検索を破棄する', async () => {
    const { router } = renderWithProviders({ initialUrl: '/' });
    const searchInput = await screen.findByRole('textbox', { name: 'ブックマークを検索' });

    vi.useFakeTimers();
    fireEvent.change(searchInput, { target: { value: 'stale' } });
    await act(async () => {
      await router.navigate({ to: '/', search: { folder: '/folder-a' } });
    });

    expect(searchInput).toHaveValue('');
    act(() => vi.advanceTimersByTime(300));
    await act(async () => Promise.resolve());
    expect(router.state.location.search).toEqual({ folder: '/folder-a' });
  });

  it('アンマウント時に保留中の検索タイマーを破棄する', async () => {
    const { router, unmount } = renderWithProviders({ initialUrl: '/' });
    const searchInput = await screen.findByRole('textbox', { name: 'ブックマークを検索' });

    vi.useFakeTimers();
    fireEvent.change(searchInput, { target: { value: 'stale' } });
    unmount();
    act(() => vi.advanceTimersByTime(300));
    await act(async () => Promise.resolve());

    expect(router.state.location.search).toEqual({});
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

  it('正規URLを直接開くと未分類だけを表示し、サイドバーも選択状態になる', async () => {
    const { router } = renderWithProviders({ initialUrl: '/?view=uncategorized' });

    expect(await screen.findByRole('heading', { name: '未分類' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '未分類' })).toHaveClass(
      'bg-blue-100',
      'font-semibold',
    );
    expect(await screen.findByText(mockBookmarks[0].title!)).toBeInTheDocument();
    expect(await screen.findByText(mockBookmarks[1].title!)).toBeInTheDocument();
    expect(screen.queryByText(mockBookmarks[2].title!)).not.toBeInTheDocument();
    expect(router.state.location.search).toEqual({ view: 'uncategorized' });
  });

  it('旧URLは履歴を増やさず未分類の正規URLへ置換する', async () => {
    const { router } = renderWithProviders({ initialUrl: '/?folder=__uncategorized__' });

    expect(await screen.findByRole('heading', { name: '未分類' })).toBeInTheDocument();
    await waitFor(() => {
      expect(router.state.location.href).toBe('/?view=uncategorized');
    });
    expect(router.history.length).toBe(1);
    expect(router.history.canGoBack()).toBe(false);
  });

  it('正規化時にhashを維持し、履歴を増やさない', async () => {
    const { router } = renderWithProviders({
      initialUrl: '/?folder=__uncategorized__#bookmark-1',
    });

    await waitFor(() => {
      expect(router.history.location.href).toBe('/?view=uncategorized#bookmark-1');
    });
    expect(router.history.location.hash).toBe('#bookmark-1');
    expect(router.history.length).toBe(1);
    expect(router.history.canGoBack()).toBe(false);
  });

  it('正規化時にhistory stateを維持し、履歴を増やさない', async () => {
    const { router } = renderWithProviders({
      initialUrl: '/?view=unknown',
      initialState: {
        bkmkSearchRevision: 7,
        callerState: 'preserved',
      },
    });

    await waitFor(() => expect(router.history.location.href).toBe('/'));
    expect(router.history.location.state).toMatchObject({
      bkmkSearchRevision: 7,
      callerState: 'preserved',
    });
    expect(router.history.location.state.__TSR_key).toEqual(expect.any(String));
    expect(router.history.length).toBe(1);
    expect(router.history.canGoBack()).toBe(false);
  });

  it.each([
    ['未対応view', '/?view=unknown', {}, '/'],
    ['q優先', '/?q=keyword&folder=%2Fwork&view=uncategorized', { q: 'keyword' }, '/?q=keyword'],
    [
      '実在形式のfolder優先',
      '/?folder=%2Fwork&view=uncategorized',
      { folder: '/work' },
      '/?folder=%2Fwork',
    ],
    [
      '不正folderより未分類view優先',
      '/?folder=not-a-path&view=uncategorized',
      { view: 'uncategorized' },
      '/?view=uncategorized',
    ],
  ])('%sの競合parameterをreplaceで正規化する', async (_name, initialUrl, search, href) => {
    const { router } = renderWithProviders({ initialUrl });

    await waitFor(() => expect(router.state.location.href).toBe(href));
    expect(router.state.location.search).toEqual(search);
    expect(router.history.length).toBe(1);
    expect(router.history.canGoBack()).toBe(false);
  });

  it.each([
    ['q', '/?q=keyword&q=keyword', { q: 'keyword' }, '/?q=keyword'],
    ['folder', '/?folder=%2Fwork&folder=%2Fother', { folder: '/work' }, '/?folder=%2Fwork'],
    [
      'view',
      '/?view=uncategorized&view=uncategorized',
      { view: 'uncategorized' },
      '/?view=uncategorized',
    ],
  ])('%sの重複parameterを1つにreplaceで正規化する', async (_name, initialUrl, search, href) => {
    const { router } = renderWithProviders({ initialUrl });

    await waitFor(() => expect(router.state.location.href).toBe(href));
    expect(router.state.location.search).toEqual(search);
    expect(router.history.length).toBe(1);
    expect(router.history.canGoBack()).toBe(false);
  });

  it.each([
    ['slash未escape', '/?folder=/work', { folder: '/work' }, '/?folder=%2Fwork'],
    ['小文字percent escape', '/?folder=%2fwork', { folder: '/work' }, '/?folder=%2Fwork'],
    ['spaceのpercent escape', '/?q=hello%20world', { q: 'hello world' }, '/?q=hello+world'],
  ])('%sの非正規表記を履歴を増やさずreplaceする', async (_name, initialUrl, search, href) => {
    const { router } = renderWithProviders({ initialUrl });

    await waitFor(() => expect(router.history.location.href).toBe(href));
    expect(router.state.location.search).toEqual(search);
    expect(router.history.length).toBe(1);
    expect(router.history.canGoBack()).toBe(false);
  });

  it('「未分類」をクリックするとフォルダ未所属のブックマークのみ表示される', async () => {
    const user = userEvent.setup();
    const { router } = renderWithProviders({ initialUrl: '/' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '未分類' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '未分類' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '未分類' })).toBeInTheDocument();
    });
    expect(router.state.location.search).toEqual({ view: 'uncategorized' });

    await waitFor(() => {
      expect(screen.getByText(mockBookmarks[0].title!)).toBeInTheDocument();
    });
    expect(screen.getByText(mockBookmarks[1].title!)).toBeInTheDocument();
    expect(screen.queryByText(mockBookmarks[2].title!)).not.toBeInTheDocument();
  });

  it('未分類からフォルダ、検索、すべてへ移動すると不要なparameterを残さない', async () => {
    const user = userEvent.setup();
    const { router } = renderWithProviders({ initialUrl: '/?view=uncategorized' });

    await user.click(await screen.findByRole('button', { name: 'work' }));
    await waitFor(() => expect(router.state.location.search).toEqual({ folder: '/work' }));

    const searchInput = screen.getByRole('textbox', { name: 'ブックマークを検索' });
    await user.type(searchInput, 'keyword');
    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'keyword' }));

    await user.click(screen.getByRole('button', { name: 'すべて' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });

  it('すべて表示の削除はAPI応答前にカードを消し、確認ダイアログを表示しない', async () => {
    let deleted = false;
    let resolveDelete!: () => void;
    const deleteResponse = new Promise<void>((resolve) => {
      resolveDelete = resolve;
    });
    let notifyDeleteStarted!: () => void;
    const deleteStarted = new Promise<void>((resolve) => {
      notifyDeleteStarted = resolve;
    });
    let notifyRefetched!: () => void;
    const refetched = new Promise<void>((resolve) => {
      notifyRefetched = resolve;
    });
    server.use(
      http.get('/api/bookmarks', ({ request }) => {
        const bookmarks = deleted ? mockBookmarks.slice(1) : mockBookmarks;
        if (deleted) notifyRefetched();
        return new URL(request.url).searchParams.has('limit')
          ? HttpResponse.json({ data: bookmarks, nextCursor: null })
          : HttpResponse.json(bookmarks);
      }),
      http.delete('/api/bookmarks/:id', async () => {
        notifyDeleteStarted();
        await deleteResponse;
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders({ initialUrl: '/' });

    await waitFor(() => {
      expect(screen.getByText(mockBookmarks[0].title!)).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button', { name: '削除' });
    await user.click(deleteButtons[0]);
    await deleteStarted;

    try {
      expect(screen.queryByText(mockBookmarks[0].title!)).not.toBeInTheDocument();
      expect(screen.queryByText('ブックマークを削除')).not.toBeInTheDocument();
    } finally {
      resolveDelete();
      await refetched;
    }

    await waitFor(() => {
      expect(screen.queryByText(mockBookmarks[0].title!)).not.toBeInTheDocument();
    });
  });
});

function markAsOverflowing(element: HTMLElement) {
  Object.defineProperties(element, {
    scrollWidth: { configurable: true, value: 600 },
    clientWidth: { configurable: true, value: 160 },
  });
  fireEvent(window, new Event('resize'));
}
