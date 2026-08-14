import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { client } from '../lib/api-client';
import type { Bookmark } from '../types';

const PAGE_SIZE = 30;

interface PaginatedResponse {
  data: Bookmark[];
  nextCursor: string | null;
}

export function useBookmarks(folderPath: string | null, deep: boolean) {
  return useQuery<Bookmark[]>({
    queryKey: ['bookmarks', { folder: folderPath, deep }],
    queryFn: async () => {
      const res = await client.api.bookmarks.$get({
        query: {
          folder: folderPath ?? undefined,
          deep: deep ? 'true' : undefined,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch bookmarks');
      return (await res.json()) as Bookmark[];
    },
  });
}

export function useBookmarksPaginated(folderPath: string | null, deep: boolean) {
  return useInfiniteQuery<PaginatedResponse>({
    queryKey: ['bookmarks', 'paginated', { folder: folderPath, deep }],
    queryFn: async ({ pageParam }) => {
      const res = await client.api.bookmarks.$get({
        query: {
          folder: folderPath ?? undefined,
          deep: deep ? 'true' : undefined,
          grouped: 'true',
          limit: String(PAGE_SIZE),
          cursor: (pageParam as string) || undefined,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch bookmarks');
      return (await res.json()) as PaginatedResponse;
    },
    initialPageParam: '' as string,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
