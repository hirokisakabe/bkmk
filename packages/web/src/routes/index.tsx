import { type DragEndEvent } from '@dnd-kit/core';
import { useQueryClient } from '@tanstack/react-query';
import { createRoute } from '@tanstack/react-router';

import { BookmarkList } from '../components/bookmark-list';
import { useMoveBookmark } from '../hooks/use-move-bookmark';
import { useReorderBookmark } from '../hooks/use-reorder-bookmark';
import { useReorderFolder } from '../hooks/use-reorder-folder';
import { Layout } from '../components/layout';
import { SearchResults } from '../components/search-results';
import { requireAuth } from '../lib/auth-guard';
import { UNCATEGORIZED_FOLDER } from '../lib/constants';
import { resolveBookmarkMoveTarget, resolveBookmarkReorderTarget } from '../lib/dnd-reorder';
import type { Bookmark, Folder } from '../types';
import { rootRoute } from './__root';

interface IndexSearch {
  folder?: string;
  q?: string;
}

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>): IndexSearch => ({
    folder: typeof search.folder === 'string' ? search.folder : undefined,
    q: typeof search.q === 'string' && search.q.trim().length > 0 ? search.q.trim() : undefined,
  }),
  component: IndexPage,
});

function IndexPage() {
  const { folder, q } = indexRoute.useSearch();

  const queryClient = useQueryClient();
  const reorderBookmark = useReorderBookmark();
  const reorderFolder = useReorderFolder();
  const moveBookmark = useMoveBookmark();

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeData = active.data.current;
    const overData = over.data.current;
    if (!activeData || !overData) return;

    if (activeData.type === 'bookmark' && overData.type === 'bookmark') {
      if (reorderBookmark.isPending) return;
      if (activeData.bookmark.folderPath !== overData.bookmark.folderPath) return;
      const cached = queryClient.getQueryData<Bookmark[]>([
        'bookmarks',
        { folder: activeData.bookmark.folderPath, deep: false },
      ]);
      const target = resolveBookmarkReorderTarget(cached, String(active.id), String(over.id));
      if (!target) return;
      reorderBookmark.mutate(target);
    } else if (activeData.type === 'bookmark' && overData.type !== 'bookmark') {
      if (moveBookmark.isPending) return;
      const moveTarget = resolveBookmarkMoveTarget(
        activeData as { type: string; bookmark: Pick<Bookmark, 'id' | 'folderPath'> },
        overData as { type: string; folder?: Pick<Folder, 'path'> },
      );
      if (!moveTarget) return;
      moveBookmark.mutate(moveTarget);
    } else if (activeData.type === 'folder' && overData.type === 'folder') {
      if (reorderFolder.isPending) return;
      if (activeData.folder.parentPath !== overData.folder.parentPath) return;
      reorderFolder.mutate({
        id: activeData.folder.id,
        position: overData.folder.position,
      });
    }
  };

  const folderName =
    folder === UNCATEGORIZED_FOLDER
      ? '未分類'
      : folder
        ? folder.split('/').pop() || folder
        : 'すべて';
  const isSearching = !!q;

  return (
    <Layout onDragEnd={handleDragEnd}>
      {isSearching ? (
        <SearchResults query={q!} />
      ) : (
        <BookmarkList folderPath={folder ?? null} folderName={folderName} />
      )}
    </Layout>
  );
}
