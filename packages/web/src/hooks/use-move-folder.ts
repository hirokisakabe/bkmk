import { useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../lib/api-client';
import type { Folder } from '../types';

export function useMoveFolder() {
  const queryClient = useQueryClient();

  return useMutation<Folder, Error, { id: string; parentPath: string | null }>({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}
