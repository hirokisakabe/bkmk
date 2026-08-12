import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { mockBookmarks } from '../test/handlers';
import { renderWithProviders } from '../test/render';
import { server } from '../test/server';
import type { Bookmark } from '../types';

describe('bookmark creation card', () => {
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
    expect(within(pendingCard).getByText('情報を取得中')).toBeInTheDocument();
    expect(within(pendingCard).getByText(url)).toBeInTheDocument();
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
