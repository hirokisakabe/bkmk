import { useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../lib/api-client';

export function useDeleteTrashItem() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const res = await client.api.trash[':id'].$delete({
        param: { id },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: undefined }));
        throw new Error(('error' in body ? body.error : undefined) || '完全削除に失敗しました');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] });
    },
  });
}
