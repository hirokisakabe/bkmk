import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '../lib/api-client';
import type { Folder } from '../types';

export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation<Folder, Error, { path: string }>({
    mutationFn: async ({ path }) => {
      const res = await apiFetch('/folders', {
        method: 'POST',
        body: JSON.stringify({ path }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'フォルダの作成に失敗しました');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}
