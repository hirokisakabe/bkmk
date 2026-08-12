import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useLayoutEffect, useRef } from 'react';

import { client } from '../lib/api-client';
import {
  rebaseBookmarkQueryData,
  rebaseBookmarkQueryKey,
  rebaseFolderPath,
  rebaseFolders,
  type BookmarkQueryData,
} from '../lib/folder-paths';
import type { Folder } from '../types';

interface FolderPathSelection {
  selectedFolder: string | null;
  onSelectFolder: (path: string | null) => void;
}

interface MutationContext {
  previousFolderQueries: [queryKey: QueryKey, data: Folder[] | undefined][];
  previousBookmarkQueries: [queryKey: QueryKey, data: BookmarkQueryData | undefined][];
  bookmarkQueryMigrations: [sourceQueryKey: QueryKey, destinationQueryKey: QueryKey][];
  previousSelectedFolder: string | null;
  optimisticSelectedFolder: string | null;
  selectionChanged: boolean;
}

export function useMoveFolder(selection: FolderPathSelection) {
  const queryClient = useQueryClient();
  const selectedFolderRef = useRef(selection.selectedFolder);

  useLayoutEffect(() => {
    selectedFolderRef.current = selection.selectedFolder;
  }, [selection.selectedFolder]);

  return useMutation<Folder, Error, { id: string; parentPath: string | null }, MutationContext>({
    mutationFn: async ({ id, parentPath }) => {
      const res = await client.api.folders[':id'].$patch({
        param: { id },
        json: { parentPath },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: undefined }));
        throw new Error(
          ('error' in body ? body.error : undefined) || 'フォルダの移動に失敗しました',
        );
      }

      return (await res.json()) as Folder;
    },
    onMutate: async ({ id, parentPath }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['folders'] }),
        queryClient.cancelQueries({ queryKey: ['bookmarks'] }),
      ]);
      const previousFolderQueries = queryClient.getQueriesData<Folder[]>({
        queryKey: ['folders'],
      });
      const previousBookmarkQueries = queryClient.getQueriesData<BookmarkQueryData>({
        queryKey: ['bookmarks'],
      });
      const folder = previousFolderQueries
        .flatMap(([, data]) => data ?? [])
        .find((candidate) => candidate.id === id);
      const previousSelectedFolder = selectedFolderRef.current;

      if (!folder) {
        return {
          previousFolderQueries,
          previousBookmarkQueries,
          bookmarkQueryMigrations: [],
          previousSelectedFolder,
          optimisticSelectedFolder: previousSelectedFolder,
          selectionChanged: false,
        };
      }

      const oldPath = folder.path;
      const newPath = parentPath === null ? `/${folder.name}` : `${parentPath}/${folder.name}`;

      queryClient.setQueriesData<Folder[]>({ queryKey: ['folders'] }, (old) => {
        if (!old) return old;
        return rebaseFolders(old, {
          folderId: id,
          oldPath,
          newPath,
          newParentPath: parentPath,
          newName: folder.name,
          moved: parentPath !== folder.parentPath,
        });
      });

      const bookmarkQueryMigrations: [QueryKey, QueryKey][] = [];
      const migratedBookmarkQueries: [QueryKey, BookmarkQueryData | undefined][] = [];
      for (const [queryKey, data] of previousBookmarkQueries) {
        const optimisticData = rebaseBookmarkQueryData(data, oldPath, newPath);
        const optimisticQueryKey = rebaseBookmarkQueryKey(queryKey, oldPath, newPath);
        if (optimisticQueryKey === queryKey) {
          queryClient.setQueryData(queryKey, optimisticData);
        } else {
          bookmarkQueryMigrations.push([queryKey, optimisticQueryKey]);
          migratedBookmarkQueries.push([optimisticQueryKey, optimisticData]);
        }
      }
      migratedBookmarkQueries.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });

      const optimisticSelectedFolder = rebaseFolderPath(previousSelectedFolder, oldPath, newPath);
      const selectionChanged = optimisticSelectedFolder !== previousSelectedFolder;
      if (selectionChanged) {
        selectedFolderRef.current = optimisticSelectedFolder;
        selection.onSelectFolder(optimisticSelectedFolder);
      }

      return {
        previousFolderQueries,
        previousBookmarkQueries,
        bookmarkQueryMigrations,
        previousSelectedFolder,
        optimisticSelectedFolder,
        selectionChanged,
      };
    },
    onError: (_err, _vars, context) => {
      context?.bookmarkQueryMigrations.forEach(([, destinationQueryKey]) => {
        const existedBefore = context.previousBookmarkQueries.some(
          ([previousQueryKey]) =>
            JSON.stringify(previousQueryKey) === JSON.stringify(destinationQueryKey),
        );
        if (!existedBefore) {
          queryClient.removeQueries({ queryKey: destinationQueryKey, exact: true });
        }
      });
      context?.previousFolderQueries.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      context?.previousBookmarkQueries.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      if (
        context?.selectionChanged &&
        selectedFolderRef.current === context.optimisticSelectedFolder
      ) {
        selectedFolderRef.current = context.previousSelectedFolder;
        selection.onSelectFolder(context.previousSelectedFolder);
      }
    },
    onSuccess: (_data, _vars, context) => {
      context.bookmarkQueryMigrations.forEach(([sourceQueryKey]) => {
        queryClient.removeQueries({ queryKey: sourceQueryKey, exact: true });
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}
