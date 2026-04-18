import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '../lib/api-client';
import type { Bookmark } from '../types';

export function useCreateBookmark() {
  const queryClient = useQueryClient();

  return useMutation<Bookmark, Error, { url: string; folderPath: string | null }>({
    mutationFn: async ({ url, folderPath }) => {
      const res = await apiFetch('/bookmarks', {
        method: 'POST',
        body: JSON.stringify({ url, folderPath }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'ブックマークの追加に失敗しました');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}
