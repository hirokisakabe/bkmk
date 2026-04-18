import { useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../lib/api-client';
import type { Folder } from '../types';

export function useMoveFolder() {
  const queryClient = useQueryClient();

  return useMutation<
    Folder,
    Error,
    { id: string; parentPath: string | null },
    { previousQueries: [queryKey: unknown[], data: Folder[] | undefined][] }
  >({
    mutationFn: async ({ id, parentPath }) => {
      const res = await client.api.folders[':id'].$patch({
        param: { id },
        json: { parentPath },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: undefined }));
        throw new Error(
          ('error' in body ? body.error : undefined) || 'フォルダの移動に失敗しました',
        );
      }

      return (await res.json()) as Folder;
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['folders'] });
      const previousQueries = queryClient.getQueriesData<Folder[]>({
        queryKey: ['folders'],
      });

      queryClient.setQueriesData<Folder[]>({ queryKey: ['folders'] }, (old) => {
        if (!old) return old;
        return old.filter((f) => f.id !== id);
      });

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      context?.previousQueries.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}
