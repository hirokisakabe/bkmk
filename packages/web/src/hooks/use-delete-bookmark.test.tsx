import { QueryClient, QueryClientProvider, type InfiniteData } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '../test/server';
import type { Bookmark } from '../types';
import { useDeleteBookmark } from './use-delete-bookmark';

const bookmark = (id: string): Bookmark => ({
  id,
  userId: 'test-user',
  url: `https://example.com/${id}`,
  title: id,
  description: null,
  imageUrl: null,
  faviconUrl: null,
  folderPath: null,
  position: 0,
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
});

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

describe('useDeleteBookmark', () => {
  it('API失敗時にpaginated cacheをrollbackする', async () => {
    server.use(http.delete('/api/bookmarks/:id', () => HttpResponse.json({}, { status: 500 })));
    const { queryClient, Wrapper } = setup();
    const key = ['bookmarks', 'paginated', { folder: null, deep: true }];
    const before: InfiniteData<{ data: Bookmark[]; nextCursor: string | null }> = {
      pages: [{ data: [bookmark('a'), bookmark('b')], nextCursor: null }],
      pageParams: [''],
    };
    queryClient.setQueryData(key, before);

    const { result } = renderHook(() => useDeleteBookmark(), { wrapper: Wrapper });
    await expect(result.current.mutateAsync({ id: 'a' })).rejects.toThrow(
      'ブックマークの削除に失敗しました',
    );

    expect(queryClient.getQueryData(key)).toEqual(before);
  });
});
