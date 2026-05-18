import { useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../lib/api-client';
import type { Bookmark } from '../types';

export function useMoveBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, folderPath }: { id: string; folderPath: string | null }) => {
      const res = await client.api.bookmarks[':id'].$patch({
        param: { id },
        json: { folderPath },
      });
      if (!res.ok) throw new Error('ブックマークの移動に失敗しました');
      return res.json();
    },
    onMutate: async ({ id, folderPath }) => {
      await queryClient.cancelQueries({ queryKey: ['bookmarks'] });
      const previousQueries = queryClient.getQueriesData<Bookmark[]>({
        queryKey: ['bookmarks'],
      });

      const movedBookmark = previousQueries
        .flatMap(([, data]) => (Array.isArray(data) ? data : []))
        .find((b) => b.id === id);

      queryClient.setQueriesData<Bookmark[]>({ queryKey: ['bookmarks'] }, (old) => {
        if (!old || !Array.isArray(old)) return old;
        return old
          .filter((b) => b.id !== id)
          .map((b) => {
            if (
              movedBookmark &&
              b.folderPath === movedBookmark.folderPath &&
              b.position > movedBookmark.position
            ) {
              return { ...b, position: b.position - 1 };
            }
            return b;
          });
      });

      if (movedBookmark) {
        const updated = { ...movedBookmark, folderPath, position: 0 };

        const targetKey = ['bookmarks', { folder: folderPath, deep: false }];
        const targetData = queryClient.getQueryData<Bookmark[]>(targetKey);
        if (targetData) {
          queryClient.setQueryData<Bookmark[]>(targetKey, [
            updated,
            ...targetData.map((b) => ({ ...b, position: b.position + 1 })),
          ]);
        }

        const allKey = ['bookmarks', { folder: null, deep: true }];
        const allData = queryClient.getQueryData<Bookmark[]>(allKey);
        if (allData) {
          queryClient.setQueryData<Bookmark[]>(allKey, [
            updated,
            ...allData.map((b) =>
              b.folderPath === folderPath ? { ...b, position: b.position + 1 } : b,
            ),
          ]);
        }
      }

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
