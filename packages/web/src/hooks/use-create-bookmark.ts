import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { client } from '../lib/api-client';
import type { Bookmark } from '../types';

const bookmarkCreationsKey = ['bookmark-creations'] as const;

export type BookmarkCreation =
  | {
      status: 'pending';
      clientId: string;
      url: string;
      folderPath: string | null;
    }
  | {
      status: 'error';
      clientId: string;
      url: string;
      folderPath: string | null;
      error: string;
    }
  | {
      status: 'success';
      clientId: string;
      url: string;
      folderPath: string | null;
      bookmark: Bookmark;
    };

export function isBookmarkInScope(
  folderPath: string | null,
  folder: string | null,
  deep: boolean,
): boolean {
  if (!deep) return folderPath === folder;
  if (folder === null) return true;
  return folderPath === folder || folderPath?.startsWith(`${folder}/`) === true;
}

export function useBookmarkCreations() {
  return useQuery<BookmarkCreation[]>({
    queryKey: bookmarkCreationsKey,
    queryFn: () => [],
    initialData: [],
    staleTime: Infinity,
  });
}

export function useCreateBookmark() {
  const queryClient = useQueryClient();

  return useMutation<
    Bookmark,
    Error,
    { url: string; folderPath: string | null },
    { clientId: string }
  >({
    mutationFn: async ({ url, folderPath }) => {
      const res = await client.api.bookmarks.$post({
        json: { url, folderPath },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: undefined }));
        throw new Error(
          ('error' in body ? body.error : undefined) || 'ブックマークの追加に失敗しました',
        );
      }

      return (await res.json()) as Bookmark;
    },
    onMutate: ({ url, folderPath }) => {
      const clientId = crypto.randomUUID();
      queryClient.setQueryData<BookmarkCreation[]>(bookmarkCreationsKey, (current = []) => [
        { status: 'pending', clientId, url, folderPath },
        ...current.filter(
          (creation) => creation.folderPath !== folderPath || creation.status !== 'error',
        ),
      ]);
      return { clientId };
    },
    onSuccess: (created, _variables, context) => {
      queryClient.setQueryData<BookmarkCreation[]>(bookmarkCreationsKey, (current = []) =>
        current.map((creation) =>
          creation.clientId === context.clientId
            ? { ...creation, status: 'success', bookmark: created }
            : creation,
        ),
      );
    },
    onError: (error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData<BookmarkCreation[]>(bookmarkCreationsKey, (current = []) =>
        current.map((creation) =>
          creation.clientId === context.clientId
            ? { ...creation, status: 'error', error: error.message }
            : creation,
        ),
      );
    },
    onSettled: async (created, _error, _variables, context) => {
      await queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      if (!created || !context) return;
      queryClient.setQueryData<BookmarkCreation[]>(bookmarkCreationsKey, (current = []) =>
        current.filter((creation) => creation.clientId !== context.clientId),
      );
    },
  });
}
