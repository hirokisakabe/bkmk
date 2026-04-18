import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '../lib/api-client';

export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const res = await apiFetch(`/folders/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'フォルダの削除に失敗しました');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}
