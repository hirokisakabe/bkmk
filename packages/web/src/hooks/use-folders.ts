import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../lib/api-client';
import type { Folder } from '../types';

export function useFolders(parentPath: string | null, enabled = true) {
  return useQuery<Folder[]>({
    queryKey: ['folders', { parent: parentPath }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (parentPath !== null) {
        params.set('parent', parentPath);
      }
      const query = params.toString();
      const res = await apiFetch(`/folders${query ? `?${query}` : ''}`);
      if (!res.ok) throw new Error('Failed to fetch folders');
      return res.json();
    },
    enabled,
  });
}
