import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました');
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});
