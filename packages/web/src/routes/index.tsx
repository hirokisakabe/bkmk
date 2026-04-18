import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { createRoute, useNavigate } from '@tanstack/react-router';

import { BookmarkList } from '../components/bookmark-list';
import { FolderTree } from '../components/folder-tree';
import { useMoveBookmark } from '../hooks/use-move-bookmark';
import { useReorderBookmark } from '../hooks/use-reorder-bookmark';
import { useReorderFolder } from '../hooks/use-reorder-folder';
import { Layout, SearchInput } from '../components/layout';
import { SearchResults } from '../components/search-results';
import { requireAuth } from '../lib/auth-guard';
import { UNCATEGORIZED_FOLDER } from '../lib/constants';
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
  const navigate = useNavigate();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

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
      reorderBookmark.mutate({
        id: activeData.bookmark.id,
        position: overData.bookmark.position,
      });
    } else if (
      activeData.type === 'bookmark' &&
      (overData.type === 'folder' || overData.type === 'folder-root')
    ) {
      if (moveBookmark.isPending) return;
      const targetPath: string | null =
        overData.type === 'folder-root' ? null : overData.folder.path;
      if (activeData.bookmark.folderPath === targetPath) return;
      moveBookmark.mutate({
        id: activeData.bookmark.id,
        folderPath: targetPath,
      });
    } else if (activeData.type === 'folder' && overData.type === 'folder') {
      if (reorderFolder.isPending) return;
      if (activeData.folder.parentPath !== overData.folder.parentPath) return;
      reorderFolder.mutate({
        id: activeData.folder.id,
        position: overData.folder.position,
      });
    }
  };

  const handleSearch = (query: string) => {
    navigate({
      to: '/',
      search: {
        folder: query ? undefined : folder,
        q: query || undefined,
      },
    });
  };

  const folderName =
    folder === UNCATEGORIZED_FOLDER
      ? '未分類'
      : folder
        ? folder.split('/').pop() || folder
        : 'すべて';
  const isSearching = !!q;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <Layout
        searchInput={<SearchInput key={q ?? ''} defaultValue={q ?? ''} onSearch={handleSearch} />}
        sidebar={
          <FolderTree
            selectedFolder={isSearching ? null : (folder ?? null)}
            onSelectFolder={(path) =>
              navigate({
                to: '/',
                search: { folder: path ?? undefined, q: undefined },
              })
            }
          />
        }
      >
        {isSearching ? (
          <SearchResults query={q!} />
        ) : (
          <BookmarkList folderPath={folder ?? null} folderName={folderName} />
        )}
      </Layout>
    </DndContext>
  );
}
