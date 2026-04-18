import { useQuery } from '@tanstack/react-query';

import { client } from '../lib/api-client';
import type { Bookmark, Folder } from '../types';

export function useTrash() {
  return useQuery<{ folders: Folder[]; bookmarks: Bookmark[] }>({
    queryKey: ['trash'],
    queryFn: async () => {
      const res = await client.api.trash.$get();
      if (!res.ok) throw new Error('Failed to fetch trash');
      return (await res.json()) as { folders: Folder[]; bookmarks: Bookmark[] };
    },
  });
}
