import { useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../lib/api-client';
import { removeBookmarkFromQueryData, type BookmarkQueryData } from '../lib/bookmark-query-data';

export function useDeleteBookmark() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { id: string },
    { previousQueries: [queryKey: readonly unknown[], data: BookmarkQueryData | undefined][] }
  >({
    mutationFn: async ({ id }) => {
      const res = await client.api.bookmarks[':id'].$delete({
        param: { id },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: undefined }));
        throw new Error(
          ('error' in body ? body.error : undefined) || 'ブックマークの削除に失敗しました',
        );
      }
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['bookmarks'] });
      const previousQueries = queryClient.getQueriesData<BookmarkQueryData>({
        queryKey: ['bookmarks'],
      });

      queryClient.setQueriesData<BookmarkQueryData>({ queryKey: ['bookmarks'] }, (old) =>
        removeBookmarkFromQueryData(old, id),
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
