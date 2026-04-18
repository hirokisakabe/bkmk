import { useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../lib/api-client';
import type { Folder } from '../types';

export function useRenameFolder() {
  const queryClient = useQueryClient();

  return useMutation<
    Folder,
    Error,
    { id: string; name: string },
    { previousQueries: [queryKey: readonly unknown[], data: Folder[] | undefined][] }
  >({
    mutationFn: async ({ id, name }) => {
      const res = await client.api.folders[':id'].$patch({
        param: { id },
        json: { name },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: undefined }));
        throw new Error(
          ('error' in body ? body.error : undefined) || 'フォルダ名の変更に失敗しました',
        );
      }

      return (await res.json()) as Folder;
    },
    onMutate: async ({ id, name }) => {
      await queryClient.cancelQueries({ queryKey: ['folders'] });
      const previousQueries = queryClient.getQueriesData<Folder[]>({
        queryKey: ['folders'],
      });

      queryClient.setQueriesData<Folder[]>({ queryKey: ['folders'] }, (old) => {
        if (!old) return old;
        return old.map((f) => (f.id === id ? { ...f, name } : f));
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
