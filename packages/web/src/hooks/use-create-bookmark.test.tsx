import { type InfiniteData, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

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
  it('API応答前は仮データを保持し、成功時は通常・すべて・ページネーションを正式データへ置換する', async () => {
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
    queryClient.setQueryData<Bookmark[]>(bookmarkKey('/work'), [
      makeBookmark('work-existing', 0, '/work'),
    ]);
    queryClient.setQueryData<Bookmark[]>(bookmarkKey(null, true), [
      makeBookmark('other', 0, '/other'),
      makeBookmark('work-existing', 0, '/work'),
    ]);
    queryClient.setQueryData<Bookmark[]>(bookmarkKey('/other'), [
      makeBookmark('other', 0, '/other'),
    ]);
    queryClient.setQueryData<InfiniteData<Page>>(paginatedKey(null, true), {
      pages: [
        {
          data: [makeBookmark('work-existing', 0, '/work'), makeBookmark('created', 99, '/work')],
          nextCursor: null,
        },
      ],
      pageParams: [''],
    });

    const { result } = renderHook(() => useCreateBookmark(), { wrapper: Wrapper });
    const mutation = act(() =>
      result.current.mutateAsync({ url: created.url, folderPath: created.folderPath }),
    );
    await requestStarted;

    expect(queryClient.getQueryData<BookmarkCreation[]>(['bookmark-creations'])).toEqual([
      expect.objectContaining({
        status: 'pending',
        url: created.url,
        folderPath: '/work',
      }),
    ]);

    finishRequest();
    await mutation;

    expect(queryClient.getQueryData<BookmarkCreation[]>(['bookmark-creations'])).toEqual([]);
    expect(queryClient.getQueryData<Bookmark[]>(bookmarkKey('/work'))).toEqual([
      created,
      expect.objectContaining({ id: 'work-existing', position: 1 }),
    ]);
    expect(queryClient.getQueryData<Bookmark[]>(bookmarkKey(null, true))).toEqual([
      created,
      expect.objectContaining({ id: 'other', position: 0 }),
      expect.objectContaining({ id: 'work-existing', position: 1 }),
    ]);
    expect(
      queryClient.getQueryData<Bookmark[]>(bookmarkKey('/other'))?.map(({ id }) => id),
    ).toEqual(['other']);

    const paginated = queryClient.getQueryData<InfiniteData<Page>>(paginatedKey(null, true));
    expect(paginated?.pages[0].data).toEqual([
      created,
      expect.objectContaining({ id: 'work-existing', position: 1 }),
    ]);
  });

  it('失敗時はURLとエラーを残し、同じURLの再試行時に失敗データをpendingへ置き換える', async () => {
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

    let finishRetry!: () => void;
    const retryStarted = new Promise<void>((resolveStarted) => {
      server.use(
        http.post('/api/bookmarks', async () => {
          resolveStarted();
          await new Promise<void>((resolve) => {
            finishRetry = resolve;
          });
          return HttpResponse.json(makeBookmark('retried', 0, null, { url: variables.url }), {
            status: 201,
          });
        }),
      );
    });

    const retry = act(() => result.current.mutateAsync(variables));
    await retryStarted;
    expect(queryClient.getQueryData<BookmarkCreation[]>(['bookmark-creations'])).toEqual([
      expect.objectContaining({ status: 'pending', url: variables.url }),
    ]);

    finishRetry();
    await retry;
    await waitFor(() => {
      expect(queryClient.getQueryData<BookmarkCreation[]>(['bookmark-creations'])).toEqual([]);
    });
  });
});
