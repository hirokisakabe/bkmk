import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../lib/api-client';
import type { Bookmark } from '../types';

export function useBookmarks(folderPath: string | null, deep: boolean) {
  return useQuery<Bookmark[]>({
    queryKey: ['bookmarks', { folder: folderPath, deep }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (folderPath !== null) {
        params.set('folder', folderPath);
      }
      if (deep) {
        params.set('deep', 'true');
      }
      const query = params.toString();
      const res = await apiFetch(`/bookmarks${query ? `?${query}` : ''}`);
      if (!res.ok) throw new Error('Failed to fetch bookmarks');
      return res.json();
    },
  });
}
