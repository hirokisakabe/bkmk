import { useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../lib/api-client';
import {
  bookmarksFromQueryData,
  moveBookmarkInQueryData,
  type BookmarkQueryData,
} from '../lib/bookmark-query-data';

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
      const previousQueries = queryClient.getQueriesData<BookmarkQueryData>({
        queryKey: ['bookmarks'],
      });

      const movedBookmark = previousQueries
        .flatMap(([, data]) => bookmarksFromQueryData(data))
        .find((b) => b.id === id);

      if (movedBookmark) {
        previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData<BookmarkQueryData>(
            queryKey,
            moveBookmarkInQueryData(data, queryKey, movedBookmark, folderPath),
          );
        });
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
