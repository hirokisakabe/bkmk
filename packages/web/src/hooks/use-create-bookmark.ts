import { useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../lib/api-client';
import type { Bookmark } from '../types';

export function useCreateBookmark() {
  const queryClient = useQueryClient();

  return useMutation<Bookmark, Error, { url: string; folderPath: string | null }>({
    mutationFn: async ({ url, folderPath }) => {
      const res = await client.api.bookmarks.$post({
        json: { url, folderPath },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: undefined }));
        throw new Error(
          ('error' in body ? body.error : undefined) || 'ブックマークの追加に失敗しました',
        );
      }

      return (await res.json()) as Bookmark;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}
