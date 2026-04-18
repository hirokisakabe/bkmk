import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '../lib/api-client';
import type { Folder } from '../types';

export function useRenameFolder() {
  const queryClient = useQueryClient();

  return useMutation<Folder, Error, { id: string; name: string }>({
    mutationFn: async ({ id, name }) => {
      const res = await apiFetch(`/folders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'フォルダ名の変更に失敗しました');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}
