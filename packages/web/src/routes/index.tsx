import { type DragEndEvent } from '@dnd-kit/core';
import { useQueryClient } from '@tanstack/react-query';
import { createRoute, useRouter, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';

import { BookmarkList } from '../components/bookmark-list';
import { LandingPage } from '../components/landing-page';
import { useMoveBookmark } from '../hooks/use-move-bookmark';
import { useAllFolders } from '../hooks/use-folders';
import { useReorderBookmark } from '../hooks/use-reorder-bookmark';
import { useReorderFolder } from '../hooks/use-reorder-folder';
import { Layout } from '../components/layout';
import { SearchResults } from '../components/search-results';
import { getOptionalSession } from '../lib/auth-guard';
import {
  LEGACY_UNCATEGORIZED_FOLDER,
  UNCATEGORIZED_VIEW,
  type BookmarkView,
} from '../lib/constants';
import {
  resolveBookmarkMoveTarget,
  resolveBookmarkReorderTarget,
  resolveCanReorderBookmarks,
} from '../lib/dnd-reorder';
import { useSettings } from '../lib/settings-store';
import type { Bookmark, Folder } from '../types';
import { rootRoute } from './__root';

interface IndexSearch {
  folder?: string;
  q?: string;
  view?: BookmarkView;
}

function firstSearchValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function canonicalizeSearch(search: Record<string, unknown>): IndexSearch {
  const q = firstSearchValue(search.q);
  const folder = firstSearchValue(search.folder);
  const view = firstSearchValue(search.view);

  if (typeof q === 'string' && q.trim().length > 0) {
    return { q: q.trim() };
  }
  if (typeof folder === 'string' && folder.startsWith('/')) {
    return { folder };
  }
  if (view === UNCATEGORIZED_VIEW || folder === LEGACY_UNCATEGORIZED_FOLDER) {
    return { view: UNCATEGORIZED_VIEW };
  }
  return {};
}

function buildIndexHref(search: IndexSearch) {
  const searchParams = new URLSearchParams();
  if (search.q) searchParams.set('q', search.q);
  if (search.folder) searchParams.set('folder', search.folder);
  if (search.view) searchParams.set('view', search.view);
  const searchString = searchParams.toString();
  return searchString ? `/?${searchString}` : '/';
}

function isCanonicalSearch(rawSearchString: string, search: IndexSearch) {
  return rawSearchString === buildIndexHref(search).slice(1);
}

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: getOptionalSession,
  validateSearch: canonicalizeSearch,
  component: IndexPage,
});

function IndexPage() {
  const { session } = indexRoute.useRouteContext();
  const router = useRouter();
  const location = useRouterState({ select: (state) => state.location });

  useEffect(() => {
    const rawLocation = router.history.location;
    if (rawLocation.pathname !== '/') return;
    const rawSearchString = rawLocation.search;
    const canonicalSearch = canonicalizeSearch(router.options.parseSearch(rawSearchString));
    if (!isCanonicalSearch(rawSearchString, canonicalSearch)) {
      router.history.replace(buildIndexHref(canonicalSearch));
    }
  }, [location, router]);

  if (!session) return <LandingPage />;

  return <BookmarkManager />;
}

function BookmarkManager() {
  const { folder, q, view } = indexRoute.useSearch();
  const [settings] = useSettings();

  const queryClient = useQueryClient();
  const reorderBookmark = useReorderBookmark();
  const reorderFolder = useReorderFolder();
  const moveBookmark = useMoveBookmark();

  const { data: allFolders = [], isLoading: isFoldersLoading } = useAllFolders();
  const isUncategorized = view === UNCATEGORIZED_VIEW;
  const isAllBookmarks = folder === undefined && !isUncategorized;
  const currentFolderPath = folder ?? null;
  const deep = isAllBookmarks
    ? true
    : !isUncategorized && folder !== undefined && settings.includeSubfolders;
  // deep=true のときフォルダ一覧未取得中は保守的に「サブフォルダあり」とみなしソートを抑制する
  const hasSubfolders =
    deep && isFoldersLoading ? true : allFolders.some((f) => f.parentPath === currentFolderPath);
  const canReorderBookmarks = resolveCanReorderBookmarks({ isAllBookmarks, deep, hasSubfolders });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeData = active.data.current;
    const overData = over.data.current;
    if (!activeData || !overData) return;

    if (activeData.type === 'bookmark' && overData.type === 'bookmark') {
      if (!canReorderBookmarks) return;
      if (reorderBookmark.isPending) return;
      if (activeData.bookmark.folderPath !== overData.bookmark.folderPath) return;
      if (activeData.bookmark.folderPath !== currentFolderPath) return;
      const raw = queryClient.getQueryData<Bookmark[]>([
        'bookmarks',
        { folder: activeData.bookmark.folderPath, deep },
      ]);
      // deep=true のとき複数フォルダが混在するため同一フォルダのみに絞る
      const cached = raw?.filter((b) => b.folderPath === activeData.bookmark.folderPath);
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

  const folderName = isUncategorized
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
        <BookmarkList folderPath={currentFolderPath} folderName={folderName} view={view} />
      )}
    </Layout>
  );
}
