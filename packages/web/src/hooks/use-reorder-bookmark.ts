import { useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../lib/api-client';
import { applyBookmarkReorder } from '../lib/dnd-reorder';
import type { Bookmark } from '../types';

export function useReorderBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
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
      const previousQueries = queryClient.getQueriesData<Bookmark[]>({
        queryKey: ['bookmarks'],
      });

      queryClient.setQueriesData<Bookmark[]>({ queryKey: ['bookmarks'] }, (old) => {
        if (!old || !Array.isArray(old)) return old;
        return applyBookmarkReorder(old, id, position);
      });

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
