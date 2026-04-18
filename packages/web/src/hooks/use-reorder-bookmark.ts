import { useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../lib/api-client';
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
        if (!old) return old;
        const item = old.find((b) => b.id === id);
        if (!item) return old;

        const oldPosition = item.position;
        const targetFolderPath = item.folderPath;
        return old
          .map((b) => {
            if (b.id === id) return { ...b, position };
            if (b.folderPath !== targetFolderPath) return b;
            if (oldPosition < position) {
              if (b.position > oldPosition && b.position <= position) {
                return { ...b, position: b.position - 1 };
              }
            } else {
              if (b.position >= position && b.position < oldPosition) {
                return { ...b, position: b.position + 1 };
              }
            }
            return b;
          })
          .sort((a, b) => a.position - b.position);
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
