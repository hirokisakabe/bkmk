import { type InfiniteData, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../test/server';
import type { Bookmark } from '../types';
import { type BookmarkCreation, useCreateBookmark } from './use-create-bookmark';

interface Page {
  data: Bookmark[];
  nextCursor: string | null;
}

const bookmarkKey = (folder: string | null, deep = false) => ['bookmarks', { folder, deep }];
const paginatedKey = (folder: string | null, deep = false) => [
  'bookmarks',
  'paginated',
  { folder, deep },
];

const makeBookmark = (
  id: string,
  position: number,
  folderPath: string | null,
  overrides: Partial<Bookmark> = {},
): Bookmark => ({
  id,
  userId: 'test-user',
  url: `https://example.com/${id}`,
  title: id,
  description: null,
  imageUrl: null,
  faviconUrl: null,
  folderPath,
  position,
  deletedAt: null,
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z',
  ...overrides,
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return { queryClient, Wrapper };
}

describe('useCreateBookmark', () => {
  it('正式レスポンスを表示しながらserver refetchを待ち、複数ページのdataとcursorを手動変更しない', async () => {
    const created = makeBookmark('created', 0, '/work', {
      url: 'https://new.example.com',
      title: '取得したタイトル',
      imageUrl: 'https://new.example.com/ogp.png',
    });
    let finishRequest!: () => void;
    const requestStarted = new Promise<void>((resolveStarted) => {
      server.use(
        http.post('/api/bookmarks', async () => {
          resolveStarted();
          await new Promise<void>((resolve) => {
            finishRequest = resolve;
          });
          return HttpResponse.json(created, { status: 201 });
        }),
      );
    });

    const { queryClient, Wrapper } = createWrapper();
    const shiftedDirect = [makeBookmark('work-existing', 1, '/work')];
    const paginatedBefore: InfiniteData<Page> = {
      pages: [
        {
          data: [makeBookmark('first-page', 1, '/work')],
          nextCursor: 'position-1',
        },
        {
          data: [makeBookmark('second-page', 2, '/work')],
          nextCursor: null,
        },
      ],
      pageParams: ['', 'position-1'],
    };
    queryClient.setQueryData<Bookmark[]>(bookmarkKey('/work'), shiftedDirect);
    queryClient.setQueryData<InfiniteData<Page>>(paginatedKey('/work'), paginatedBefore);

    let finishInvalidation!: () => void;
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishInvalidation = resolve;
        }),
    );

    const { result } = renderHook(() => useCreateBookmark(), { wrapper: Wrapper });
    const mutation = act(() =>
      result.current.mutateAsync({ url: created.url, folderPath: created.folderPath }),
    );
    await requestStarted;
    expect(queryClient.getQueryData<BookmarkCreation[]>(['bookmark-creations'])).toEqual([
      expect.objectContaining({ status: 'pending', url: created.url, folderPath: '/work' }),
    ]);

    finishRequest();
    await waitFor(() => {
      expect(queryClient.getQueryData<BookmarkCreation[]>(['bookmark-creations'])).toEqual([
        expect.objectContaining({ status: 'success', bookmark: created }),
      ]);
    });
    expect(queryClient.getQueryData<Bookmark[]>(bookmarkKey('/work'))).toEqual(shiftedDirect);
    expect(queryClient.getQueryData<InfiniteData<Page>>(paginatedKey('/work'))).toEqual(
      paginatedBefore,
    );

    queryClient.setQueryData<Bookmark[]>(bookmarkKey('/work'), [created, ...shiftedDirect]);
    finishInvalidation();
    await mutation;
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookmarks'] });
    expect(queryClient.getQueryData<BookmarkCreation[]>(['bookmark-creations'])).toEqual([]);
  });

  it('一覧refetchで正式IDを確認できない場合は成功カードを保持する', async () => {
    const created = makeBookmark('created', 0, null);
    server.use(http.post('/api/bookmarks', () => HttpResponse.json(created, { status: 201 })));
    const { queryClient, Wrapper } = createWrapper();
    vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    const { result } = renderHook(() => useCreateBookmark(), { wrapper: Wrapper });

    await act(() => result.current.mutateAsync({ url: created.url, folderPath: null }));

    expect(queryClient.getQueryData<BookmarkCreation[]>(['bookmark-creations'])).toEqual([
      expect.objectContaining({ status: 'success', bookmark: created }),
    ]);
  });

  it('POST失敗後の一覧refetchを待たずにmutationを完了する', async () => {
    server.use(
      http.post('/api/bookmarks', () =>
        HttpResponse.json({ error: '追加に失敗しました' }, { status: 500 }),
      ),
    );
    const { queryClient, Wrapper } = createWrapper();
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useCreateBookmark(), { wrapper: Wrapper });

    await expect(
      act(() =>
        result.current.mutateAsync({ url: 'https://failed.example.com', folderPath: null }),
      ),
    ).rejects.toThrow('追加に失敗しました');
    expect(result.current.isPending).toBe(false);
    expect(queryClient.getQueryData<BookmarkCreation[]>(['bookmark-creations'])).toEqual([
      expect.objectContaining({ status: 'error', error: '追加に失敗しました' }),
    ]);
  });

  it('失敗時はURLとエラーを残し、同じURLで再試行できる', async () => {
    server.use(
      http.post('/api/bookmarks', () =>
        HttpResponse.json({ error: 'OGPの取得に失敗しました' }, { status: 502 }),
      ),
    );
    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateBookmark(), { wrapper: Wrapper });
    const variables = { url: 'https://retry.example.com', folderPath: null };

    await expect(act(() => result.current.mutateAsync(variables))).rejects.toThrow(
      'OGPの取得に失敗しました',
    );
    expect(queryClient.getQueryData<BookmarkCreation[]>(['bookmark-creations'])).toEqual([
      expect.objectContaining({
        status: 'error',
        url: variables.url,
        error: 'OGPの取得に失敗しました',
      }),
    ]);

    server.use(
      http.post('/api/bookmarks', () =>
        HttpResponse.json(makeBookmark('retried', 0, null, { url: variables.url }), {
          status: 201,
        }),
      ),
    );
    await act(() => result.current.mutateAsync(variables));
    expect(queryClient.getQueryData<BookmarkCreation[]>(['bookmark-creations'])).toEqual([
      expect.objectContaining({
        status: 'success',
        bookmark: expect.objectContaining({ id: 'retried' }),
      }),
    ]);
  });

  it('URLを修正して再送すると同じフォルダの古いエラーカードを置き換える', async () => {
    server.use(
      http.post('/api/bookmarks', () =>
        HttpResponse.json({ error: 'URLが見つかりません' }, { status: 404 }),
      ),
    );
    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateBookmark(), { wrapper: Wrapper });

    await expect(
      act(() =>
        result.current.mutateAsync({ url: 'https://wrong.example.com', folderPath: '/work' }),
      ),
    ).rejects.toThrow('URLが見つかりません');

    let finishRetry!: () => void;
    server.use(
      http.post('/api/bookmarks', async () => {
        await new Promise<void>((resolve) => {
          finishRetry = resolve;
        });
        return HttpResponse.json(
          makeBookmark('corrected', 0, '/work', { url: 'https://correct.example.com' }),
          { status: 201 },
        );
      }),
    );
    const retry = act(() =>
      result.current.mutateAsync({ url: 'https://correct.example.com', folderPath: '/work' }),
    );

    await waitFor(() => {
      expect(queryClient.getQueryData<BookmarkCreation[]>(['bookmark-creations'])).toEqual([
        expect.objectContaining({ status: 'pending', url: 'https://correct.example.com' }),
      ]);
    });
    finishRetry();
    await retry;
  });
});
