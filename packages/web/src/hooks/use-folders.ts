import { useQuery } from '@tanstack/react-query';

import { client } from '../lib/api-client';
import type { Folder } from '../types';

export function useAllFolders() {
  return useQuery<Folder[]>({
    queryKey: ['folders', 'all'],
    queryFn: async () => {
      const res = await client.api.folders.$get({
        query: {
          all: 'true',
        },
      });
      if (!res.ok) throw new Error('Failed to fetch folders');
      return (await res.json()) as Folder[];
    },
  });
}

export function getChildFolders(allFolders: Folder[], parentPath: string | null): Folder[] {
  return allFolders.filter((f) => f.parentPath === parentPath);
}
