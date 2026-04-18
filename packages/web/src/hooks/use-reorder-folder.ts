import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '../lib/api-client';

export function useReorderFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, position }: { id: string; position: number }) => {
      const res = await apiFetch(`/folders/${id}/position`, {
        method: 'PATCH',
        body: JSON.stringify({ position }),
      });
      if (!res.ok) throw new Error('Failed to reorder folder');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}
