import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../lib/api-client';
import type { SearchResult } from '../types';

export function useSearch(query: string) {
  return useQuery<SearchResult[]>({
    queryKey: ['search', query],
    queryFn: async () => {
      const res = await apiFetch(`/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Failed to search bookmarks');
      return res.json();
    },
    enabled: query.length > 0,
  });
}
