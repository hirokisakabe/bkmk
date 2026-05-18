import { useMutation, useQueryClient } from '@tanstack/react-query';

import { applyFolderReorder } from '../lib/dnd-reorder';
import { client } from '../lib/api-client';
import type { Folder } from '../types';

export function useReorderFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, position }: { id: string; position: number }) => {
      const res = await client.api.folders[':id'].position.$patch({
        param: { id },
        json: { position },
      });
      if (!res.ok) throw new Error('フォルダの並び替えに失敗しました');
      return res.json();
    },
    onMutate: async ({ id, position }) => {
      await queryClient.cancelQueries({ queryKey: ['folders'] });
      const previousQueries = queryClient.getQueriesData<Folder[]>({
        queryKey: ['folders'],
      });

      queryClient.setQueriesData<Folder[]>({ queryKey: ['folders'] }, (old) => {
        if (!old || !Array.isArray(old)) return old;
        return applyFolderReorder(old, id, position);
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
    },
  });
}
