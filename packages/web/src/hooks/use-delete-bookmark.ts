import { useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../lib/api-client';
import type { Bookmark } from '../types';

export function useDeleteBookmark() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { id: string },
    { previousQueries: [queryKey: readonly unknown[], data: Bookmark[] | undefined][] }
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
      const previousQueries = queryClient.getQueriesData<Bookmark[]>({
        queryKey: ['bookmarks'],
      });

      queryClient.setQueriesData<Bookmark[]>({ queryKey: ['bookmarks'] }, (old) => {
        if (!old) return old;
        return old.filter((b) => b.id !== id);
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
