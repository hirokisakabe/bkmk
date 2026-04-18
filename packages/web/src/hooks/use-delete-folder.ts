import { useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../lib/api-client';
import type { Folder } from '../types';

export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { id: string },
    { previousFolderQueries: [queryKey: unknown[], data: Folder[] | undefined][] }
  >({
    mutationFn: async ({ id }) => {
      const res = await client.api.folders[':id'].$delete({
        param: { id },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: undefined }));
        throw new Error(
          ('error' in body ? body.error : undefined) || 'フォルダの削除に失敗しました',
        );
      }
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['folders'] });
      const previousFolderQueries = queryClient.getQueriesData<Folder[]>({
        queryKey: ['folders'],
      });

      queryClient.setQueriesData<Folder[]>({ queryKey: ['folders'] }, (old) => {
        if (!old) return old;
        return old.filter((f) => f.id !== id);
      });

      return { previousFolderQueries };
    },
    onError: (_err, _vars, context) => {
      context?.previousFolderQueries.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}
