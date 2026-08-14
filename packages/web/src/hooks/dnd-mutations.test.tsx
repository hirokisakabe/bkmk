import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../test/server';
import type { Bookmark, Folder } from '../types';
import { useMoveBookmark } from './use-move-bookmark';
import { useReorderBookmark } from './use-reorder-bookmark';
import { useReorderFolder } from './use-reorder-folder';

const bookmarkKey = (folder: string | null, deep = false) => ['bookmarks', { folder, deep }];

const makeBookmark = (id: string, position: number, folderPath: string | null): Bookmark => ({
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
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
});

const makeFolder = (id: string, position: number, parentPath: string | null): Folder => ({
  id,
  userId: 'test-user',
  name: id,
  path: parentPath ? `${parentPath}/${id}` : `/${id}`,
  parentPath,
  position,
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
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

describe('DnD mutation hooks', () => {
  it('useReorderBookmark は楽観的更新で同一フォルダ内だけ並び替え、成功後にinvalidateする', async () => {
    let resolvePatch!: () => void;
    const patchStarted = new Promise<void>((resolve) => {
      server.use(
        http.patch('/api/bookmarks/:id/position', async () => {
          resolve();
          await new Promise<void>((resolveRequest) => {
            resolvePatch = resolveRequest;
          });
          return HttpResponse.json(makeBookmark('a', 2, '/work'));
        }),
      );
    });

    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    queryClient.setQueryData<Bookmark[]>(bookmarkKey('/work'), [
      makeBookmark('a', 0, '/work'),
      makeBookmark('b', 1, '/work'),
      makeBookmark('c', 2, '/work'),
    ]);
    queryClient.setQueryData<Bookmark[]>(bookmarkKey(null, true), [
      makeBookmark('a', 0, '/work'),
      makeBookmark('other', 0, '/other'),
      makeBookmark('b', 1, '/work'),
      makeBookmark('c', 2, '/work'),
    ]);
    const paginatedKey = ['bookmarks', 'paginated', { folder: null, deep: true }];
    queryClient.setQueryData(paginatedKey, {
      pages: [
        {
          data: [makeBookmark('a', 0, '/work'), makeBookmark('b', 1, '/work')],
          nextCursor: 'page-2',
        },
        {
          data: [makeBookmark('c', 2, '/work'), makeBookmark('other', 0, '/other')],
          nextCursor: null,
        },
      ],
      pageParams: ['', 'page-2'],
    });

    const { result } = renderHook(() => useReorderBookmark(), { wrapper: Wrapper });
    const mutation = act(() => result.current.mutateAsync({ id: 'a', position: 2 }));
    await patchStarted;

    expect(queryClient.getQueryData<Bookmark[]>(bookmarkKey('/work'))?.map((b) => b.id)).toEqual([
      'b',
      'c',
      'a',
    ]);
    expect(
      queryClient.getQueryData<Bookmark[]>(bookmarkKey('/work'))?.find((b) => b.id === 'b'),
    ).toMatchObject({ folderPath: '/work', position: 0 });
    expect(queryClient.getQueryData<Bookmark[]>(bookmarkKey(null, true))?.map((b) => b.id)).toEqual(
      ['b', 'other', 'c', 'a'],
    );
    expect(
      queryClient.getQueryData<Bookmark[]>(bookmarkKey(null, true))?.find((b) => b.id === 'other'),
    ).toMatchObject({ folderPath: '/other', position: 0 });
    const paginated = queryClient.getQueryData<{
      pages: Array<{ data: Bookmark[]; nextCursor: string | null }>;
      pageParams: string[];
    }>(paginatedKey);
    expect(
      paginated?.pages.map((page) =>
        page.data.map((bookmark) => `${bookmark.id}:${bookmark.position}`),
      ),
    ).toEqual([
      ['b:0', 'c:1'],
      ['a:2', 'other:0'],
    ]);
    expect(paginated?.pages.map((page) => page.nextCursor)).toEqual(['page-2', null]);
    expect(paginated?.pageParams).toEqual(['', 'page-2']);

    resolvePatch();
    await mutation;

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookmarks'] });
  });

  it('useReorderBookmark はAPI失敗時に楽観的更新をrollbackする', async () => {
    server.use(
      http.patch('/api/bookmarks/:id/position', () => HttpResponse.json({}, { status: 500 })),
    );

    const { queryClient, Wrapper } = createWrapper();
    const before = [makeBookmark('a', 0, null), makeBookmark('b', 1, null)];
    queryClient.setQueryData<Bookmark[]>(bookmarkKey(null), before);

    const { result } = renderHook(() => useReorderBookmark(), { wrapper: Wrapper });
    await expect(result.current.mutateAsync({ id: 'a', position: 1 })).rejects.toThrow(
      'ブックマークの並び替えに失敗しました',
    );

    expect(queryClient.getQueryData<Bookmark[]>(bookmarkKey(null))).toEqual(before);
  });

  it('useReorderFolder は楽観的更新、rollback、invalidateを扱う', async () => {
    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const before = [
      makeFolder('a', 0, null),
      makeFolder('b', 1, null),
      makeFolder('child', 0, '/a'),
    ];
    queryClient.setQueryData<Folder[]>(['folders'], before);

    server.use(
      http.patch('/api/folders/:id/position', () => HttpResponse.json(makeFolder('a', 1, null))),
    );

    const { result, rerender } = renderHook(() => useReorderFolder(), { wrapper: Wrapper });
    await act(() => result.current.mutateAsync({ id: 'a', position: 1 }));

    expect(
      queryClient.getQueryData<Folder[]>(['folders'])?.map((f) => `${f.id}:${f.position}`),
    ).toEqual(['b:0', 'child:0', 'a:1']);
    expect(
      queryClient.getQueryData<Folder[]>(['folders'])?.find((f) => f.id === 'child'),
    ).toMatchObject({ parentPath: '/a', position: 0 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['folders'] });

    server.use(
      http.patch('/api/folders/:id/position', () => HttpResponse.json({}, { status: 500 })),
    );
    queryClient.setQueryData<Folder[]>(['folders'], before);
    rerender();

    await expect(result.current.mutateAsync({ id: 'a', position: 1 })).rejects.toThrow(
      'フォルダの並び替えに失敗しました',
    );
    expect(queryClient.getQueryData<Folder[]>(['folders'])).toEqual(before);
  });

  it('useMoveBookmark は移動元・移動先・all queryを楽観的に同期し、成功後にinvalidateする', async () => {
    let resolvePatch!: () => void;
    const patchStarted = new Promise<void>((resolve) => {
      server.use(
        http.patch('/api/bookmarks/:id', async () => {
          resolve();
          await new Promise<void>((resolveRequest) => {
            resolvePatch = resolveRequest;
          });
          return HttpResponse.json(makeBookmark('a', 0, '/target'));
        }),
      );
    });

    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const moved = makeBookmark('a', 1, '/source');
    const sourceAfterMoved = makeBookmark('c', 2, '/source');
    const targetExisting = makeBookmark('b', 0, '/target');

    queryClient.setQueryData<Bookmark[]>(bookmarkKey('/source'), [
      makeBookmark('before', 0, '/source'),
      moved,
      sourceAfterMoved,
    ]);
    queryClient.setQueryData<Bookmark[]>(bookmarkKey('/target'), [targetExisting]);
    queryClient.setQueryData<Bookmark[]>(bookmarkKey(null, true), [
      makeBookmark('before', 0, '/source'),
      moved,
      sourceAfterMoved,
      targetExisting,
    ]);
    const paginatedKey = ['bookmarks', 'paginated', { folder: null, deep: true }];
    queryClient.setQueryData(paginatedKey, {
      pages: [
        {
          data: [makeBookmark('before', 0, '/source'), moved],
          nextCursor: 'page-2',
        },
        { data: [sourceAfterMoved, targetExisting], nextCursor: null },
      ],
      pageParams: ['', 'page-2'],
    });

    const { result } = renderHook(() => useMoveBookmark(), { wrapper: Wrapper });
    const mutation = act(() => result.current.mutateAsync({ id: 'a', folderPath: '/target' }));
    await patchStarted;

    expect(queryClient.getQueryData<Bookmark[]>(bookmarkKey('/source'))?.map((b) => b.id)).toEqual([
      'before',
      'c',
    ]);
    expect(
      queryClient.getQueryData<Bookmark[]>(bookmarkKey('/source'))?.find((b) => b.id === 'c'),
    ).toMatchObject({ folderPath: '/source', position: 1 });
    expect(queryClient.getQueryData<Bookmark[]>(bookmarkKey('/target'))?.map((b) => b.id)).toEqual([
      'a',
      'b',
    ]);
    expect(queryClient.getQueryData<Bookmark[]>(bookmarkKey('/target'))?.[0]).toMatchObject({
      folderPath: '/target',
      position: 0,
    });
    expect(queryClient.getQueryData<Bookmark[]>(bookmarkKey('/target'))?.[1]).toMatchObject({
      folderPath: '/target',
      position: 1,
    });
    expect(queryClient.getQueryData<Bookmark[]>(bookmarkKey(null, true))?.map((b) => b.id)).toEqual(
      ['a', 'before', 'c', 'b'],
    );
    expect(queryClient.getQueryData<Bookmark[]>(bookmarkKey(null, true))?.[0]).toMatchObject({
      folderPath: '/target',
      position: 0,
    });
    expect(queryClient.getQueryData<Bookmark[]>(bookmarkKey(null, true))?.[3]).toMatchObject({
      folderPath: '/target',
      position: 1,
    });
    expect(
      queryClient
        .getQueryData<{ pages: Array<{ data: Bookmark[] }> }>(paginatedKey)
        ?.pages.flatMap((page) => page.data)
        .map((bookmark) => `${bookmark.id}:${bookmark.folderPath}:${bookmark.position}`),
    ).toEqual(['a:/target:0', 'before:/source:0', 'c:/source:1', 'b:/target:1']);

    resolvePatch();
    await mutation;
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookmarks'] });
  });

  it('useMoveBookmark はAPI失敗時に全bookmark queryをrollbackする', async () => {
    server.use(http.patch('/api/bookmarks/:id', () => HttpResponse.json({}, { status: 500 })));

    const { queryClient, Wrapper } = createWrapper();
    const moved = makeBookmark('a', 0, '/source');
    const source = [moved];
    const target = [makeBookmark('b', 0, '/target')];
    const all = [moved, target[0]];
    queryClient.setQueryData<Bookmark[]>(bookmarkKey('/source'), source);
    queryClient.setQueryData<Bookmark[]>(bookmarkKey('/target'), target);
    queryClient.setQueryData<Bookmark[]>(bookmarkKey(null, true), all);

    const { result } = renderHook(() => useMoveBookmark(), { wrapper: Wrapper });
    await expect(result.current.mutateAsync({ id: 'a', folderPath: '/target' })).rejects.toThrow(
      'ブックマークの移動に失敗しました',
    );

    await waitFor(() => {
      expect(queryClient.getQueryData<Bookmark[]>(bookmarkKey('/source'))).toEqual(source);
      expect(queryClient.getQueryData<Bookmark[]>(bookmarkKey('/target'))).toEqual(target);
      expect(queryClient.getQueryData<Bookmark[]>(bookmarkKey(null, true))).toEqual(all);
    });
  });
});
