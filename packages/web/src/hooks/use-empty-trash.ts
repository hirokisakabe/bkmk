import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '../lib/api-client';

export function useEmptyTrash() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const res = await apiFetch('/trash', {
        method: 'DELETE',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'ゴミ箱を空にできませんでした');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] });
    },
  });
}
