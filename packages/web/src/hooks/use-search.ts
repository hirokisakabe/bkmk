import { useQuery } from '@tanstack/react-query';

import { client } from '../lib/api-client';
import type { SearchResult } from '../types';

export function useSearch(query: string) {
  return useQuery<SearchResult[]>({
    queryKey: ['search', query],
    queryFn: async () => {
      const res = await client.api.search.$get({
        query: { q: query },
      });
      if (!res.ok) throw new Error('Failed to search bookmarks');
      return (await res.json()) as SearchResult[];
    },
    enabled: query.length > 0,
  });
}
