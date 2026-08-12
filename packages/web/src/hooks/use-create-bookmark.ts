import {
  type InfiniteData,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

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
    };

interface PaginatedBookmarks {
  data: Bookmark[];
  nextCursor: string | null;
}

type BookmarkQueryScope = {
  folder: string | null;
  deep: boolean;
};

function getBookmarkQueryScope(queryKey: readonly unknown[]): BookmarkQueryScope | null {
  const candidate = queryKey[1] === 'paginated' ? queryKey[2] : queryKey[1];
  if (!candidate || typeof candidate !== 'object' || !('folder' in candidate)) return null;

  const folder = candidate.folder;
  const deep = 'deep' in candidate && candidate.deep === true;
  return { folder: typeof folder === 'string' ? folder : null, deep };
}

export function isBookmarkInScope(
  folderPath: string | null,
  folder: string | null,
  deep: boolean,
): boolean {
  if (!deep) return folderPath === folder;
  if (folder === null) return true;
  return folderPath === folder || folderPath?.startsWith(`${folder}/`) === true;
}

function prependCreatedBookmark(items: Bookmark[], created: Bookmark): Bookmark[] {
  return [
    created,
    ...items
      .filter((bookmark) => bookmark.id !== created.id)
      .map((bookmark) =>
        bookmark.folderPath === created.folderPath
          ? { ...bookmark, position: bookmark.position + 1 }
          : bookmark,
      ),
  ];
}

function addCreatedBookmarkToCache(queryClient: QueryClient, created: Bookmark) {
  const queries = queryClient.getQueriesData<Bookmark[] | InfiniteData<PaginatedBookmarks>>({
    queryKey: ['bookmarks'],
  });

  for (const [queryKey, data] of queries) {
    const scope = getBookmarkQueryScope(queryKey);
    if (!scope || !isBookmarkInScope(created.folderPath, scope.folder, scope.deep) || !data) {
      continue;
    }

    if (Array.isArray(data)) {
      queryClient.setQueryData(queryKey, prependCreatedBookmark(data, created));
      continue;
    }

    queryClient.setQueryData<InfiniteData<PaginatedBookmarks>>(queryKey, {
      ...data,
      pages: data.pages.map((page, index) => ({
        ...page,
        data:
          index === 0
            ? prependCreatedBookmark(page.data, created)
            : page.data
                .filter((bookmark) => bookmark.id !== created.id)
                .map((bookmark) =>
                  bookmark.folderPath === created.folderPath
                    ? { ...bookmark, position: bookmark.position + 1 }
                    : bookmark,
                ),
      })),
    });
  }
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
        ...current.filter((creation) => creation.url !== url || creation.folderPath !== folderPath),
      ]);
      return { clientId };
    },
    onSuccess: (created, _variables, context) => {
      addCreatedBookmarkToCache(queryClient, created);
      queryClient.setQueryData<BookmarkCreation[]>(bookmarkCreationsKey, (current = []) =>
        current.filter((creation) => creation.clientId !== context.clientId),
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}
