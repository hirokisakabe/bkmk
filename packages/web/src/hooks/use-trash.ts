import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../lib/api-client';
import type { Bookmark, Folder } from '../types';

export function useTrash() {
  return useQuery<{ folders: Folder[]; bookmarks: Bookmark[] }>({
    queryKey: ['trash'],
    queryFn: async () => {
      const res = await apiFetch('/trash');
      if (!res.ok) throw new Error('Failed to fetch trash');
      return res.json();
    },
  });
}
