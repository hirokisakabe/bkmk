import { useMutation, useQueryClient } from '@tanstack/react-query';

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
        if (!old) return old;
        const item = old.find((f) => f.id === id);
        if (!item) return old;

        const oldPosition = item.position;
        return old
          .map((f) => {
            if (f.id === id) return { ...f, position };
            if (oldPosition < position) {
              if (f.position > oldPosition && f.position <= position) {
                return { ...f, position: f.position - 1 };
              }
            } else {
              if (f.position >= position && f.position < oldPosition) {
                return { ...f, position: f.position + 1 };
              }
            }
            return f;
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
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}
