import { QueryClient, QueryClientProvider, type InfiniteData } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { rebaseFolderPath } from '../lib/folder-paths';
import { server } from '../test/server';
import type { Bookmark, Folder } from '../types';
import { useMoveFolder } from './use-move-folder';
import { useRenameFolder } from './use-rename-folder';

interface BookmarkPage {
  data: Bookmark[];
  nextCursor: string | null;
}

const foldersKey = ['folders', 'all'] as const;
const bookmarksKey = (folder: string | null, deep = false) =>
  ['bookmarks', { folder, deep }] as const;
const paginatedBookmarksKey = (folder: string | null, deep = false) =>
  ['bookmarks', 'paginated', { folder, deep }] as const;

const makeFolder = ({
  id,
  name,
  path,
  parentPath,
  position = 0,
}: {
  id: string;
  name: string;
  path: string;
  parentPath: string | null;
  position?: number;
}): Folder => ({
  id,
  userId: 'test-user',
  name,
  path,
  parentPath,
  position,
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
});

const makeBookmark = (id: string, folderPath: string | null): Bookmark => ({
  id,
  userId: 'test-user',
  url: `https://example.com/${id}`,
  title: id,
  description: null,
  imageUrl: null,
  faviconUrl: null,
  folderPath,
  position: 0,
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
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

function delayedFolderPatch(response: Folder) {
  let resolvePatch!: () => void;
  const patchStarted = new Promise<void>((resolve) => {
    server.use(
      http.patch('/api/folders/:id', async () => {
        resolve();
        await new Promise<void>((resolveRequest) => {
          resolvePatch = resolveRequest;
        });
        return HttpResponse.json(response);
      }),
    );
  });
  return { patchStarted, resolvePatch: () => resolvePatch() };
}

describe('folder path mutation hooks', () => {
  it('パス置換は対象自身と子孫だけに適用する', () => {
    expect(rebaseFolderPath('/work', '/work', '/archive/work')).toBe('/archive/work');
    expect(rebaseFolderPath('/work/project', '/work', '/archive/work')).toBe(
      '/archive/work/project',
    );
    expect(rebaseFolderPath('/workshop', '/work', '/archive/work')).toBe('/workshop');
    expect(rebaseFolderPath(null, '/work', '/archive/work')).toBeNull();
  });

  it('move はAPI応答前にツリー、子孫、bookmark query key、選択パスを更新する', async () => {
    const beforeFolders = [
      makeFolder({ id: 'archive', name: 'archive', path: '/archive', parentPath: null }),
      makeFolder({ id: 'work', name: 'work', path: '/work', parentPath: null, position: 1 }),
      makeFolder({
        id: 'project',
        name: 'project',
        path: '/work/project',
        parentPath: '/work',
      }),
    ];
    const directBookmarks = [makeBookmark('direct', '/work')];
    const paginatedBookmarks: InfiniteData<BookmarkPage> = {
      pages: [{ data: [makeBookmark('child', '/work/project')], nextCursor: null }],
      pageParams: [''],
    };
    const response = makeFolder({
      id: 'work',
      name: 'work',
      path: '/archive/work',
      parentPath: '/archive',
    });
    const delayedPatch = delayedFolderPatch(response);
    const onSelectFolder = vi.fn();
    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    queryClient.setQueryData(foldersKey, beforeFolders);
    queryClient.setQueryData(bookmarksKey('/work'), directBookmarks);
    queryClient.setQueryData(paginatedBookmarksKey('/work/project'), paginatedBookmarks);
    queryClient.setQueryData(bookmarksKey(null, true), [
      ...directBookmarks,
      makeBookmark('child', '/work/project'),
    ]);

    const { result } = renderHook(
      () => useMoveFolder({ selectedFolder: '/work/project', onSelectFolder }),
      { wrapper: Wrapper },
    );
    const mutation = act(() => result.current.mutateAsync({ id: 'work', parentPath: '/archive' }));
    await delayedPatch.patchStarted;

    expect(queryClient.getQueryData<Folder[]>(foldersKey)).toEqual([
      beforeFolders[0],
      expect.objectContaining({
        id: 'work',
        path: '/archive/work',
        parentPath: '/archive',
        position: 0,
      }),
      expect.objectContaining({
        id: 'project',
        path: '/archive/work/project',
        parentPath: '/archive/work',
      }),
    ]);
    expect(queryClient.getQueryData<Bookmark[]>(bookmarksKey('/archive/work'))).toEqual([
      expect.objectContaining({ id: 'direct', folderPath: '/archive/work' }),
    ]);
    expect(
      queryClient.getQueryData<InfiniteData<BookmarkPage>>(
        paginatedBookmarksKey('/archive/work/project'),
      )?.pages[0].data,
    ).toEqual([expect.objectContaining({ id: 'child', folderPath: '/archive/work/project' })]);
    expect(queryClient.getQueryData<Bookmark[]>(bookmarksKey(null, true))).toEqual([
      expect.objectContaining({ id: 'direct', folderPath: '/archive/work' }),
      expect.objectContaining({ id: 'child', folderPath: '/archive/work/project' }),
    ]);
    expect(onSelectFolder).toHaveBeenCalledWith('/archive/work/project');

    delayedPatch.resolvePatch();
    await mutation;
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['folders'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookmarks'] });
  });

  it('move のAPI失敗時は全cacheと選択パスをrollbackし、競合エラーを返す', async () => {
    server.use(
      http.patch('/api/folders/:id', () =>
        HttpResponse.json({ error: 'このフォルダはすでに登録されています' }, { status: 409 }),
      ),
    );
    const beforeFolders = [
      makeFolder({ id: 'archive', name: 'archive', path: '/archive', parentPath: null }),
      makeFolder({ id: 'work', name: 'work', path: '/work', parentPath: null }),
    ];
    const beforeBookmarks = [makeBookmark('direct', '/work')];
    const onSelectFolder = vi.fn();
    const { queryClient, Wrapper } = createWrapper();
    queryClient.setQueryData(foldersKey, beforeFolders);
    queryClient.setQueryData(bookmarksKey('/work'), beforeBookmarks);

    const { result } = renderHook(
      () => useMoveFolder({ selectedFolder: '/work', onSelectFolder }),
      { wrapper: Wrapper },
    );
    await expect(
      act(() => result.current.mutateAsync({ id: 'work', parentPath: '/archive' })),
    ).rejects.toThrow('このフォルダはすでに登録されています');

    expect(queryClient.getQueryData(foldersKey)).toEqual(beforeFolders);
    expect(queryClient.getQueryData(bookmarksKey('/work'))).toEqual(beforeBookmarks);
    expect(queryClient.getQueryData(bookmarksKey('/archive/work'))).toBeUndefined();
    expect(onSelectFolder.mock.calls).toEqual([['/archive/work'], ['/work']]);
  });

  it('rename はAPI応答前に対象名、全子孫パス、bookmark cache、選択パスを更新する', async () => {
    const beforeFolders = [
      makeFolder({ id: 'work', name: 'work', path: '/work', parentPath: null }),
      makeFolder({
        id: 'project',
        name: 'project',
        path: '/work/project',
        parentPath: '/work',
      }),
    ];
    const beforeBookmarks = [makeBookmark('child', '/work/project')];
    const response = makeFolder({ id: 'work', name: 'job', path: '/job', parentPath: null });
    const delayedPatch = delayedFolderPatch(response);
    const onSelectFolder = vi.fn();
    const { queryClient, Wrapper } = createWrapper();
    queryClient.setQueryData(foldersKey, beforeFolders);
    queryClient.setQueryData(bookmarksKey('/work/project'), beforeBookmarks);

    const { result } = renderHook(
      () => useRenameFolder({ selectedFolder: '/work/project', onSelectFolder }),
      { wrapper: Wrapper },
    );
    const mutation = act(() => result.current.mutateAsync({ id: 'work', name: 'job' }));
    await delayedPatch.patchStarted;

    expect(queryClient.getQueryData<Folder[]>(foldersKey)).toEqual([
      expect.objectContaining({ id: 'work', name: 'job', path: '/job', parentPath: null }),
      expect.objectContaining({
        id: 'project',
        path: '/job/project',
        parentPath: '/job',
      }),
    ]);
    expect(queryClient.getQueryData<Bookmark[]>(bookmarksKey('/job/project'))).toEqual([
      expect.objectContaining({ id: 'child', folderPath: '/job/project' }),
    ]);
    expect(onSelectFolder).toHaveBeenCalledWith('/job/project');

    delayedPatch.resolvePatch();
    await mutation;
  });

  it('rename のAPI失敗時はfolders、bookmarks、選択パスをrollbackする', async () => {
    server.use(http.patch('/api/folders/:id', () => HttpResponse.json({}, { status: 500 })));
    const beforeFolders = [
      makeFolder({ id: 'work', name: 'work', path: '/work', parentPath: null }),
      makeFolder({
        id: 'project',
        name: 'project',
        path: '/work/project',
        parentPath: '/work',
      }),
    ];
    const beforeBookmarks = [makeBookmark('child', '/work/project')];
    const onSelectFolder = vi.fn();
    const { queryClient, Wrapper } = createWrapper();
    queryClient.setQueryData(foldersKey, beforeFolders);
    queryClient.setQueryData(bookmarksKey('/work/project'), beforeBookmarks);

    const { result } = renderHook(
      () => useRenameFolder({ selectedFolder: '/work/project', onSelectFolder }),
      { wrapper: Wrapper },
    );
    await expect(
      act(() => result.current.mutateAsync({ id: 'work', name: 'job' })),
    ).rejects.toThrow('フォルダ名の変更に失敗しました');

    expect(queryClient.getQueryData(foldersKey)).toEqual(beforeFolders);
    expect(queryClient.getQueryData(bookmarksKey('/work/project'))).toEqual(beforeBookmarks);
    expect(queryClient.getQueryData(bookmarksKey('/job/project'))).toBeUndefined();
    expect(onSelectFolder.mock.calls).toEqual([['/job/project'], ['/work/project']]);
  });
});
