import { useMutation } from '@tanstack/react-query';

import { client } from '../lib/api-client';

export function useDeleteAccount() {
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const res = await client.api.user.$delete();

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: undefined }));
        throw new Error(
          ('error' in body ? body.error : undefined) || 'アカウントを削除できませんでした',
        );
      }
    },
  });
}
