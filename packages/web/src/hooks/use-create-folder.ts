import { useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../lib/api-client';
import type { Folder } from '../types';

export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation<Folder, Error, { path: string }>({
    mutationFn: async ({ path }) => {
      const res = await client.api.folders.$post({
        json: { path },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: undefined }));
        throw new Error(
          ('error' in body ? body.error : undefined) || 'フォルダの作成に失敗しました',
        );
      }

      return (await res.json()) as Folder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}
