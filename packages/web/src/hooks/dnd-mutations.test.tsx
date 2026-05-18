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
      makeBookmark('other', 0, '/other'),
    ]);

    const { result } = renderHook(() => useReorderBookmark(), { wrapper: Wrapper });
    const mutation = act(() => result.current.mutateAsync({ id: 'a', position: 2 }));
    await patchStarted;

    expect(queryClient.getQueryData<Bookmark[]>(bookmarkKey('/work'))?.map((b) => b.id)).toEqual([
      'b',
      'other',
      'c',
      'a',
    ]);
    expect(
      queryClient.getQueryData<Bookmark[]>(bookmarkKey('/work'))?.find((b) => b.id === 'b'),
    ).toMatchObject({ folderPath: '/work', position: 0 });
    expect(
      queryClient.getQueryData<Bookmark[]>(bookmarkKey('/work'))?.find((b) => b.id === 'other'),
    ).toMatchObject({ folderPath: '/other', position: 0 });

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
    const moved = makeBookmark('a', 0, '/source');
    const targetExisting = makeBookmark('b', 0, '/target');

    queryClient.setQueryData<Bookmark[]>(bookmarkKey('/source'), [moved]);
    queryClient.setQueryData<Bookmark[]>(bookmarkKey('/target'), [targetExisting]);
    queryClient.setQueryData<Bookmark[]>(bookmarkKey(null, true), [moved, targetExisting]);

    const { result } = renderHook(() => useMoveBookmark(), { wrapper: Wrapper });
    const mutation = act(() => result.current.mutateAsync({ id: 'a', folderPath: '/target' }));
    await patchStarted;

    expect(queryClient.getQueryData<Bookmark[]>(bookmarkKey('/source'))).toEqual([]);
    expect(queryClient.getQueryData<Bookmark[]>(bookmarkKey('/target'))?.map((b) => b.id)).toEqual([
      'a',
      'b',
    ]);
    expect(queryClient.getQueryData<Bookmark[]>(bookmarkKey('/target'))?.[0]).toMatchObject({
      folderPath: '/target',
    });
    expect(queryClient.getQueryData<Bookmark[]>(bookmarkKey(null, true))?.map((b) => b.id)).toEqual(
      ['a', 'b'],
    );
    expect(queryClient.getQueryData<Bookmark[]>(bookmarkKey(null, true))?.[0]).toMatchObject({
      folderPath: '/target',
    });

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
