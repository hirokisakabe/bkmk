import { useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../lib/api-client';
import { applyBookmarkReorder } from '../lib/dnd-reorder';
import type { Bookmark } from '../types';

interface InfiniteBookmarksData {
  pages: Array<{ data: Bookmark[]; nextCursor: string | null }>;
  pageParams: unknown[];
}

export const BOOKMARK_REORDER_MUTATION_KEY = ['reorder-bookmark'] as const;

function applyReorderToCachedData(old: unknown, id: string, position: number): unknown {
  if (Array.isArray(old)) {
    return applyBookmarkReorder(old as Bookmark[], id, position);
  }
  if (!old || typeof old !== 'object' || !('pages' in old)) return old;

  const infinite = old as InfiniteBookmarksData;
  const reordered = applyBookmarkReorder(
    infinite.pages.flatMap((page) => page.data),
    id,
    position,
  );
  let offset = 0;

  return {
    ...infinite,
    pages: infinite.pages.map((page) => {
      const data = reordered.slice(offset, offset + page.data.length);
      offset += page.data.length;
      return { ...page, data };
    }),
  };
}

export function useReorderBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: BOOKMARK_REORDER_MUTATION_KEY,
    mutationFn: async ({ id, position }: { id: string; position: number }) => {
      const res = await client.api.bookmarks[':id'].position.$patch({
        param: { id },
        json: { position },
      });
      if (!res.ok) throw new Error('ブックマークの並び替えに失敗しました');
      return res.json();
    },
    onMutate: async ({ id, position }) => {
      await queryClient.cancelQueries({ queryKey: ['bookmarks'] });
      const previousQueries = queryClient.getQueriesData<unknown>({
        queryKey: ['bookmarks'],
      });

      queryClient.setQueriesData<unknown>({ queryKey: ['bookmarks'] }, (old: unknown) =>
        applyReorderToCachedData(old, id, position),
      );

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      context?.previousQueries.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}
