import { useQuery } from '@tanstack/react-query';

import { client } from '../lib/api-client';
import type { Folder } from '../types';

export function useFolders(parentPath: string | null, enabled = true) {
  return useQuery<Folder[]>({
    queryKey: ['folders', { parent: parentPath }],
    queryFn: async () => {
      const res = await client.api.folders.$get({
        query: {
          parent: parentPath ?? undefined,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch folders');
      return (await res.json()) as Folder[];
    },
    enabled,
  });
}
