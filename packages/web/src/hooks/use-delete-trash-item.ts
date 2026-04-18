import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '../lib/api-client';

export function useDeleteTrashItem() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const res = await apiFetch(`/trash/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || '完全削除に失敗しました');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] });
    },
  });
}
