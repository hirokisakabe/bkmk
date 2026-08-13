import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { mockBookmarks } from '../test/handlers';
import { renderWithProviders } from '../test/render';
import { server } from '../test/server';
import type { Bookmark } from '../types';

describe('bookmark creation card', () => {
  it('初回一覧取得中でも送信直後の仮カードをスケルトンと同じグリッドに表示する', async () => {
    const user = userEvent.setup();
    const url = 'https://initial-loading.example.com/article';
    const created: Bookmark = {
      ...mockBookmarks[0],
      id: 'created-during-initial-loading',
      url,
      title: '初回取得中に追加したブックマーク',
    };
    let getCount = 0;
    let finishInitialRequest!: () => void;
    let finishCreateRequest!: () => void;
    let finishRefetch!: () => void;
    server.use(
      http.get('/api/bookmarks', async ({ request }) => {
        const requestUrl = new URL(request.url);
        if (!requestUrl.searchParams.has('limit')) return;
        getCount += 1;
        if (getCount === 1) {
          await new Promise<void>((resolve) => {
            finishInitialRequest = resolve;
          });
          return HttpResponse.json({ data: mockBookmarks, nextCursor: null });
        }
        await new Promise<void>((resolve) => {
          finishRefetch = resolve;
        });
        return HttpResponse.json({ data: [created, ...mockBookmarks], nextCursor: null });
      }),
      http.post('/api/bookmarks', async () => {
        await new Promise<void>((resolve) => {
          finishCreateRequest = resolve;
        });
        return HttpResponse.json(created, { status: 201 });
      }),
    );

    renderWithProviders({ initialUrl: '/' });
    const input = await screen.findByPlaceholderText('URLを入力してブックマークを追加');
    await user.type(input, url);
    await user.click(screen.getByRole('button', { name: '追加' }));

    const pendingCard = await screen.findByTestId('bookmark-creation-pending');
    const bookmarkGrid = screen.getByTestId('bookmark-grid');
    expect(bookmarkGrid.firstElementChild).toBe(pendingCard);
    expect(pendingCard.parentElement).toBe(bookmarkGrid);
    expect(screen.getAllByTestId('bookmark-loading-skeleton')).toHaveLength(6);
    expect(screen.getAllByTestId('bookmark-loading-skeleton')[0].parentElement).toBe(bookmarkGrid);

    finishInitialRequest();
    expect(await screen.findByTestId(`bookmark-card-${mockBookmarks[0].id}`)).toBeInTheDocument();
    expect(screen.getByTestId('bookmark-creation-pending')).toBeInTheDocument();

    finishCreateRequest();
    const successCard = await screen.findByTestId('bookmark-creation-success');
    expect(successCard).toBeInTheDocument();
    await waitFor(() => expect(finishRefetch).toBeDefined());

    finishRefetch();
    expect(await screen.findByTestId(`bookmark-card-${created.id}`)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId('bookmark-creation-success')).not.toBeInTheDocument();
    });
  });

  it('一覧GET失敗後も作成中・失敗・成功のフィードバックをグリッドに表示する', async () => {
    const user = userEvent.setup();
    const failedUrl = 'https://get-failed-and-create-failed.example.com';
    const successUrl = 'https://get-failed-and-create-succeeded.example.com';
    const created: Bookmark = {
      ...mockBookmarks[2],
      id: 'created-after-get-failure',
      url: successUrl,
      title: '一覧取得失敗後に追加したブックマーク',
    };
    let postCount = 0;
    let finishFailedCreate!: () => void;
    let finishSuccessfulCreate!: () => void;
    server.use(
      http.get('/api/bookmarks', ({ request }) => {
        const requestUrl = new URL(request.url);
        if (requestUrl.searchParams.has('limit')) return;
        return HttpResponse.json({ error: '一覧を取得できませんでした' }, { status: 500 });
      }),
      http.post('/api/bookmarks', async () => {
        postCount += 1;
        if (postCount === 1) {
          await new Promise<void>((resolve) => {
            finishFailedCreate = resolve;
          });
          return HttpResponse.json({ error: '対象サイトへ接続できません' }, { status: 502 });
        }
        await new Promise<void>((resolve) => {
          finishSuccessfulCreate = resolve;
        });
        return HttpResponse.json(created, { status: 201 });
      }),
    );

    const { queryClient } = renderWithProviders({ initialUrl: '/?folder=%2Fwork' });
    await waitFor(() => {
      expect(
        queryClient.getQueryState(['bookmarks', { folder: '/work', deep: false }])?.status,
      ).toBe('error');
    });
    const input = screen.getByPlaceholderText('URLを入力してブックマークを追加');
    await user.type(input, failedUrl);
    await user.click(screen.getByRole('button', { name: '追加' }));

    const firstPendingCard = await screen.findByTestId('bookmark-creation-pending');
    expect(firstPendingCard.parentElement).toBe(screen.getByTestId('bookmark-grid'));

    finishFailedCreate();
    const errorCard = await screen.findByTestId('bookmark-creation-error');
    expect(within(errorCard).getByText('対象サイトへ接続できません')).toBeInTheDocument();
    expect(errorCard.parentElement).toBe(screen.getByTestId('bookmark-grid'));

    await user.clear(input);
    await user.type(input, successUrl);
    await user.click(screen.getByRole('button', { name: '追加' }));

    const secondPendingCard = await screen.findByTestId('bookmark-creation-pending');
    expect(screen.queryByTestId('bookmark-creation-error')).not.toBeInTheDocument();
    expect(secondPendingCard.parentElement).toBe(screen.getByTestId('bookmark-grid'));

    finishSuccessfulCreate();
    const successCard = await screen.findByTestId('bookmark-creation-success');
    expect(within(successCard).getByText(created.title!)).toBeInTheDocument();
    expect(successCard.parentElement).toBe(screen.getByTestId('bookmark-grid'));
  });

  it('送信直後は操作を持たない仮カードを先頭に表示し、成功後はOGP付き正式カードへ置換する', async () => {
    const user = userEvent.setup();
    const url = 'https://pending.example.com/article';
    const created: Bookmark = {
      id: 'created-bookmark',
      userId: 'test-user',
      url,
      title: 'APIから取得したタイトル',
      description: 'APIから取得した説明',
      imageUrl: 'https://pending.example.com/ogp.png',
      faviconUrl: null,
      folderPath: null,
      position: 0,
      deletedAt: null,
      createdAt: '2026-08-12T00:00:00.000Z',
      updatedAt: '2026-08-12T00:00:00.000Z',
    };
    let finishRequest!: () => void;
    let requestFinished = false;
    server.use(
      http.post('/api/bookmarks', async () => {
        await new Promise<void>((resolve) => {
          finishRequest = resolve;
        });
        requestFinished = true;
        return HttpResponse.json(created, { status: 201 });
      }),
      http.get('/api/bookmarks', ({ request }) => {
        const requestUrl = new URL(request.url);
        if (!requestUrl.searchParams.has('limit')) return;
        return HttpResponse.json({
          data: requestFinished ? [created, ...mockBookmarks] : mockBookmarks,
          nextCursor: null,
        });
      }),
    );

    renderWithProviders({ initialUrl: '/' });
    const input = await screen.findByPlaceholderText('URLを入力してブックマークを追加');
    await user.type(input, url);
    await user.click(screen.getByRole('button', { name: '追加' }));

    const pendingCard = await screen.findByTestId('bookmark-creation-pending');
    const bookmarkGrid = screen.getByTestId('bookmark-grid');
    expect(within(pendingCard).getByText('情報を取得中')).toBeInTheDocument();
    expect(within(pendingCard).getByText(url)).toBeInTheDocument();
    expect(pendingCard.parentElement).toBe(bookmarkGrid);
    expect(
      screen
        .getByTestId(`bookmark-card-${mockBookmarks[0].id}`)
        .closest('[data-testid="bookmark-grid"]'),
    ).toBe(bookmarkGrid);
    expect(bookmarkGrid.firstElementChild).toBe(pendingCard);
    expect(within(pendingCard).queryByRole('button', { name: '削除' })).not.toBeInTheDocument();
    expect(within(pendingCard).queryByRole('button', { name: '並び替え' })).not.toBeInTheDocument();

    finishRequest();

    await waitFor(() => {
      expect(screen.queryByTestId('bookmark-creation-pending')).not.toBeInTheDocument();
    });
    const officialCard = await screen.findByTestId(`bookmark-card-${created.id}`);
    expect(within(officialCard).getByText(created.title!)).toBeInTheDocument();
    expect(within(officialCard).getByText(created.description!)).toBeInTheDocument();
    expect(officialCard.querySelector('img')).toHaveAttribute('src', created.imageUrl);
    expect(screen.getAllByText(created.title!)).toHaveLength(1);
  });

  it('並び替え可能な一覧でも仮カードと既存カードを同じグリッドに表示する', async () => {
    const user = userEvent.setup();
    const url = 'https://work-pending.example.com/article';
    const secondWorkBookmark: Bookmark = {
      ...mockBookmarks[2],
      id: 'bk-work-2',
      url: 'https://work-2.example.com',
      title: 'Second Work Site',
      position: 1,
    };
    let finishRequest!: () => void;
    const created: Bookmark = {
      ...mockBookmarks[2],
      id: 'created-work-bookmark',
      url,
      title: 'Created Work Site',
      position: 0,
    };
    server.use(
      http.get('/api/bookmarks', () => HttpResponse.json([mockBookmarks[2], secondWorkBookmark])),
      http.post('/api/bookmarks', async () => {
        await new Promise<void>((resolve) => {
          finishRequest = resolve;
        });
        return HttpResponse.json(created, { status: 201 });
      }),
    );

    renderWithProviders({ initialUrl: '/?folder=%2Fwork' });
    const input = await screen.findByPlaceholderText('URLを入力してブックマークを追加');
    await user.type(input, url);
    await user.click(screen.getByRole('button', { name: '追加' }));

    const pendingCard = await screen.findByTestId('bookmark-creation-pending');
    const bookmarkGrid = screen.getByTestId('bookmark-grid');
    expect(pendingCard.parentElement).toBe(bookmarkGrid);
    expect(
      screen
        .getByTestId(`bookmark-card-${mockBookmarks[2].id}`)
        .closest('[data-testid="bookmark-grid"]'),
    ).toBe(bookmarkGrid);
    expect(bookmarkGrid.firstElementChild).toBe(pendingCard);
    expect(screen.getByTestId(`bookmark-drag-handle-${mockBookmarks[2].id}`)).toBeInTheDocument();

    finishRequest();
    const successCard = await screen.findByTestId('bookmark-creation-success');
    expect(within(successCard).getByText(created.title!)).toBeInTheDocument();
    expect(screen.queryByTestId('bookmark-creation-pending')).not.toBeInTheDocument();
  });

  it('失敗時はエラーカードと入力URLを残す', async () => {
    const user = userEvent.setup();
    const url = 'https://failed.example.com';
    server.use(
      http.post('/api/bookmarks', () =>
        HttpResponse.json({ error: '対象サイトへ接続できません' }, { status: 502 }),
      ),
    );

    renderWithProviders({ initialUrl: '/' });
    const input = await screen.findByPlaceholderText('URLを入力してブックマークを追加');
    await user.type(input, url);
    await user.click(screen.getByRole('button', { name: '追加' }));

    const errorCard = await screen.findByTestId('bookmark-creation-error');
    expect(within(errorCard).getByText(url)).toBeInTheDocument();
    expect(within(errorCard).getByText('対象サイトへ接続できません')).toBeInTheDocument();
    expect(input).toHaveValue(url);
    expect(screen.getByRole('button', { name: '追加' })).toBeEnabled();
  });

  it('空フォルダで仮カードを表示中は空状態を同時表示しない', async () => {
    const user = userEvent.setup();
    const url = 'https://first.example.com';
    const created: Bookmark = {
      id: 'first-bookmark',
      userId: 'test-user',
      url,
      title: '最初のブックマーク',
      description: null,
      imageUrl: null,
      faviconUrl: null,
      folderPath: null,
      position: 0,
      deletedAt: null,
      createdAt: '2026-08-12T00:00:00.000Z',
      updatedAt: '2026-08-12T00:00:00.000Z',
    };
    let finishRequest!: () => void;
    let requestFinished = false;
    server.use(
      http.get('/api/bookmarks', ({ request }) => {
        const requestUrl = new URL(request.url);
        if (!requestUrl.searchParams.has('limit')) return;
        return HttpResponse.json({ data: requestFinished ? [created] : [], nextCursor: null });
      }),
      http.post('/api/bookmarks', async () => {
        await new Promise<void>((resolve) => {
          finishRequest = resolve;
        });
        requestFinished = true;
        return HttpResponse.json(created, { status: 201 });
      }),
    );

    renderWithProviders({ initialUrl: '/' });
    expect(await screen.findByText('ブックマークはありません')).toBeInTheDocument();
    const input = screen.getByPlaceholderText('URLを入力してブックマークを追加');
    await user.type(input, url);
    await user.click(screen.getByRole('button', { name: '追加' }));

    expect(await screen.findByTestId('bookmark-creation-pending')).toBeInTheDocument();
    expect(screen.queryByText('ブックマークはありません')).not.toBeInTheDocument();

    finishRequest();
    expect(await screen.findByTestId(`bookmark-card-${created.id}`)).toBeInTheDocument();
  });

  it('成功後の一覧refetchが遅くても正式カードを表示してフォームを再有効化する', async () => {
    const user = userEvent.setup();
    const url = 'https://slow-refetch.example.com';
    const created: Bookmark = {
      id: 'slow-refetch-bookmark',
      userId: 'test-user',
      url,
      title: '取得済みタイトル',
      description: '取得済み説明',
      imageUrl: null,
      faviconUrl: null,
      folderPath: null,
      position: 0,
      deletedAt: null,
      createdAt: '2026-08-12T00:00:00.000Z',
      updatedAt: '2026-08-12T00:00:00.000Z',
    };
    let getCount = 0;
    let finishRefetch!: () => void;
    server.use(
      http.get('/api/bookmarks', async ({ request }) => {
        const requestUrl = new URL(request.url);
        if (!requestUrl.searchParams.has('limit')) return;
        getCount += 1;
        if (getCount === 1) {
          return HttpResponse.json({ data: mockBookmarks, nextCursor: null });
        }
        await new Promise<void>((resolve) => {
          finishRefetch = resolve;
        });
        return HttpResponse.json({ data: [created, ...mockBookmarks], nextCursor: null });
      }),
      http.post('/api/bookmarks', () => HttpResponse.json(created, { status: 201 })),
    );

    renderWithProviders({ initialUrl: '/' });
    await screen.findByText(mockBookmarks[0].title!);
    const input = screen.getByPlaceholderText('URLを入力してブックマークを追加');
    await user.type(input, url);
    await user.click(screen.getByRole('button', { name: '追加' }));

    const successCard = await screen.findByTestId('bookmark-creation-success');
    expect(within(successCard).getByText(created.title!)).toBeInTheDocument();
    expect(within(successCard).queryByRole('button', { name: '削除' })).not.toBeInTheDocument();
    expect(within(successCard).queryByText('移動')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(input).toHaveValue('');
      expect(input).toBeEnabled();
      expect(screen.getByRole('button', { name: '追加' })).toBeInTheDocument();
      expect(finishRefetch).toBeDefined();
    });
    await user.type(input, 'https://next.example.com');
    expect(screen.getByRole('button', { name: '追加' })).toBeEnabled();

    finishRefetch();
    expect(await screen.findByTestId(`bookmark-card-${created.id}`)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId('bookmark-creation-success')).not.toBeInTheDocument();
    });
  });
});
