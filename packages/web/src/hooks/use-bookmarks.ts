import { useQuery } from '@tanstack/react-query';

import { client } from '../lib/api-client';
import type { Bookmark } from '../types';

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
