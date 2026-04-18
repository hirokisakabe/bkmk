import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '../lib/api-client';
import type { Folder } from '../types';

export function useMoveFolder() {
  const queryClient = useQueryClient();

  return useMutation<Folder, Error, { id: string; parentPath: string | null }>({
    mutationFn: async ({ id, parentPath }) => {
      const res = await apiFetch(`/folders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ parentPath }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'フォルダの移動に失敗しました');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}
