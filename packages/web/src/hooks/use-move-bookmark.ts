import { useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../lib/api-client';

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}
