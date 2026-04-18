import { useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../lib/api-client';

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}
