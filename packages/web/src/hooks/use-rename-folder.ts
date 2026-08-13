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
import { acquireFolderPathMutationLock } from './folder-path-mutation-lock';

interface FolderPathSelection {
  selectedFolder: string | null;
  onSelectFolder: (path: string | null) => void;
}

interface MutationContext {
  releaseMutationLock: () => void;
  previousFolderQueries: [queryKey: QueryKey, data: Folder[] | undefined][];
  previousBookmarkQueries: [queryKey: QueryKey, data: BookmarkQueryData | undefined][];
  bookmarkQueryMigrations: [sourceQueryKey: QueryKey, destinationQueryKey: QueryKey][];
  previousSelectedFolder: string | null;
  optimisticSelectedFolder: string | null;
  selectionChanged: boolean;
}

export function useRenameFolder(selection: FolderPathSelection) {
  const queryClient = useQueryClient();
  const selectedFolderRef = useRef(selection.selectedFolder);

  useLayoutEffect(() => {
    selectedFolderRef.current = selection.selectedFolder;
  }, [selection.selectedFolder]);

  return useMutation<Folder, Error, { id: string; name: string }, MutationContext>({
    mutationFn: async ({ id, name }) => {
      const res = await client.api.folders[':id'].$patch({
        param: { id },
        json: { name },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: undefined }));
        throw new Error(
          ('error' in body ? body.error : undefined) || 'フォルダ名の変更に失敗しました',
        );
      }

      return (await res.json()) as Folder;
    },
    onMutate: async ({ id, name }) => {
      const releaseMutationLock = await acquireFolderPathMutationLock(queryClient);
      try {
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
            releaseMutationLock,
            previousFolderQueries,
            previousBookmarkQueries,
            bookmarkQueryMigrations: [],
            previousSelectedFolder,
            optimisticSelectedFolder: previousSelectedFolder,
            selectionChanged: false,
          };
        }

        const oldPath = folder.path;
        const newPath = folder.parentPath === null ? `/${name}` : `${folder.parentPath}/${name}`;

        queryClient.setQueriesData<Folder[]>({ queryKey: ['folders'] }, (old) => {
          if (!old) return old;
          return rebaseFolders(old, {
            folderId: id,
            oldPath,
            newPath,
            newParentPath: folder.parentPath,
            newName: name,
            moved: false,
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
          releaseMutationLock,
          previousFolderQueries,
          previousBookmarkQueries,
          bookmarkQueryMigrations,
          previousSelectedFolder,
          optimisticSelectedFolder,
          selectionChanged,
        };
      } catch (error) {
        releaseMutationLock();
        throw error;
      }
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
    onSettled: (_data, _error, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      context?.releaseMutationLock();
    },
  });
}
