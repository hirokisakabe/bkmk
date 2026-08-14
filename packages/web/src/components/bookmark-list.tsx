import { useDraggable } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { useIsMutating } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type RefCallback } from 'react';

import { useBookmarks, useBookmarksPaginated } from '../hooks/use-bookmarks';
import {
  isBookmarkInScope,
  type BookmarkCreation,
  useBookmarkCreations,
} from '../hooks/use-create-bookmark';
import { useDeleteBookmark } from '../hooks/use-delete-bookmark';
import { useAllFolders } from '../hooks/use-folders';
import { BOOKMARK_REORDER_MUTATION_KEY } from '../hooks/use-reorder-bookmark';
import { UNCATEGORIZED_VIEW, type BookmarkView } from '../lib/constants';
import { folderPathsDepthFirst, groupBookmarks } from '../lib/bookmark-groups';
import { resolveCanReorderBookmarks, resolveCanSortBookmarkList } from '../lib/dnd-reorder';
import { useSettings } from '../lib/settings-store';
import type { Bookmark, Folder } from '../types';
import { AddBookmarkForm } from './add-bookmark-form';
import { BookmarkCardContent, BookmarkCardSkeleton } from './bookmark-card-content';
import { MoveBookmarkDialog } from './folder-dialogs';

export function BookmarkList({
  folderPath,
  view,
}: {
  folderPath: string | null;
  view?: BookmarkView;
}) {
  const [settings] = useSettings();
  const { data: allFolders = [], isLoading: isFoldersLoading } = useAllFolders();
  const isUncategorized = view === UNCATEGORIZED_VIEW;
  const isAllBookmarks = folderPath === null && !isUncategorized;
  const apiFolderPath = folderPath;
  const deep = isAllBookmarks
    ? true
    : !isUncategorized && folderPath !== null && settings.includeSubfolders;

  // deep=true のときフォルダ一覧未取得中は保守的に「サブフォルダあり」とみなしソートを抑制する
  const hasSubfolders =
    deep && isFoldersLoading ? true : allFolders.some((f) => f.parentPath === folderPath);
  const canReorder = resolveCanReorderBookmarks({ isAllBookmarks, deep, hasSubfolders });
  const addBookmarkFolderPath = folderPath;

  if (canReorder) {
    return (
      <ReorderableBookmarkList
        folderPath={apiFolderPath}
        deep={deep}
        addBookmarkFolderPath={addBookmarkFolderPath}
      />
    );
  }

  return (
    <PaginatedBookmarkList
      folderPath={apiFolderPath}
      deep={deep}
      addBookmarkFolderPath={addBookmarkFolderPath}
      allFolders={allFolders}
      isAllBookmarks={isAllBookmarks}
    />
  );
}

function ReorderableBookmarkList({
  folderPath,
  deep,
  addBookmarkFolderPath,
}: {
  folderPath: string | null;
  deep: boolean;
  addBookmarkFolderPath: string | null;
}) {
  const { data: bookmarks, isLoading } = useBookmarks(folderPath, deep);
  // deep=true のとき複数フォルダのブックマークが混在するため、現在のフォルダのみに絞る
  const currentFolderBookmarks = useMemo(
    () => bookmarks?.filter((bookmark) => bookmark.folderPath === folderPath),
    [bookmarks, folderPath],
  );
  const { data: creations = [] } = useBookmarkCreations(currentFolderBookmarks);
  const deleteBookmark = useDeleteBookmark();
  const visibleCreations = creations.filter(
    (creation) =>
      isBookmarkInScope(creation.folderPath, folderPath, deep) &&
      (creation.status !== 'success' ||
        !currentFolderBookmarks?.some((bookmark) => bookmark.id === creation.bookmark.id)),
  );
  const canReorder = resolveCanSortBookmarkList(currentFolderBookmarks);

  return (
    <div>
      <AddBookmarkForm folderPath={addBookmarkFolderPath} />

      {!isLoading && currentFolderBookmarks?.length === 0 && visibleCreations.length === 0 && (
        <EmptyState />
      )}

      {isLoading && (
        <div
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
          data-testid="bookmark-grid"
        >
          <BookmarkCreationCards creations={visibleCreations} />
          <LoadingSkeleton />
        </div>
      )}

      {!isLoading && currentFolderBookmarks && currentFolderBookmarks.length > 0 && canReorder && (
        <SortableContext
          items={currentFolderBookmarks.map((b) => b.id)}
          strategy={rectSortingStrategy}
        >
          <div
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
            data-testid="bookmark-grid"
          >
            <BookmarkCreationCards creations={visibleCreations} />
            {currentFolderBookmarks.map((bookmark) => (
              <SortableBookmarkCard
                key={bookmark.id}
                bookmark={bookmark}
                onDelete={() => deleteBookmark.mutate({ id: bookmark.id })}
              />
            ))}
          </div>
        </SortableContext>
      )}

      {!isLoading &&
        ((currentFolderBookmarks?.length ?? 0) > 0 || visibleCreations.length > 0) &&
        !canReorder && (
          <div
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
            data-testid="bookmark-grid"
          >
            <BookmarkCreationCards creations={visibleCreations} />
            {currentFolderBookmarks?.map((bookmark) => (
              <DraggableBookmarkCard
                key={bookmark.id}
                bookmark={bookmark}
                onDelete={() => deleteBookmark.mutate({ id: bookmark.id })}
              />
            ))}
          </div>
        )}
    </div>
  );
}

function PaginatedBookmarkList({
  folderPath,
  deep,
  addBookmarkFolderPath,
  allFolders,
  isAllBookmarks,
}: {
  folderPath: string | null;
  deep: boolean;
  addBookmarkFolderPath: string | null;
  allFolders: Folder[];
  isAllBookmarks: boolean;
}) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useBookmarksPaginated(
    folderPath,
    deep,
  );
  const bookmarks = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);
  const { data: creations = [] } = useBookmarkCreations(bookmarks);
  const deleteBookmark = useDeleteBookmark();
  const isReordering = useIsMutating({ mutationKey: BOOKMARK_REORDER_MUTATION_KEY }) > 0;

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage && !isReordering) {
          fetchNextPage();
        }
      },
      { threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isReordering, fetchNextPage]);

  const visibleCreations = creations.filter(
    (creation) =>
      isBookmarkInScope(creation.folderPath, folderPath, deep) &&
      (creation.status !== 'success' ||
        !bookmarks.some((bookmark) => bookmark.id === creation.bookmark.id)),
  );
  const groups = useMemo(() => {
    const bookmarkGroups = groupBookmarks(bookmarks, allFolders, folderPath, isAllBookmarks);
    const groupsByPath = new Map(bookmarkGroups.map((group) => [group.folderPath, group]));
    const treePaths = isAllBookmarks
      ? [null, ...folderPathsDepthFirst(allFolders, null)]
      : [folderPath, ...folderPathsDepthFirst(allFolders, folderPath)];
    const orderedPaths = [...treePaths];
    for (const group of bookmarkGroups) {
      if (!orderedPaths.includes(group.folderPath)) orderedPaths.push(group.folderPath);
    }
    for (const creation of visibleCreations) {
      if (!orderedPaths.includes(creation.folderPath)) orderedPaths.push(creation.folderPath);
    }

    return orderedPaths.flatMap((groupPath) => {
      const group = groupsByPath.get(groupPath);
      const groupCreations = visibleCreations.filter(
        (creation) => creation.folderPath === groupPath,
      );
      if (!group && groupCreations.length === 0) return [];
      return [
        {
          folderPath: groupPath,
          label: groupPath ?? '未分類',
          bookmarks: group?.bookmarks ?? [],
          creations: groupCreations,
        },
      ];
    });
  }, [allFolders, bookmarks, folderPath, isAllBookmarks, visibleCreations]);

  return (
    <div>
      <AddBookmarkForm folderPath={addBookmarkFolderPath} />

      {!isLoading && bookmarks.length === 0 && visibleCreations.length === 0 && <EmptyState />}

      {isLoading && (
        <div
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
          data-testid="bookmark-grid"
        >
          <BookmarkCreationCards creations={visibleCreations} />
          <LoadingSkeleton />
        </div>
      )}

      {!isLoading && (
        <div className="space-y-8" data-testid="bookmark-groups">
          {groups.map((group) => (
            <BookmarkGroupSection
              key={group.folderPath ?? 'uncategorized'}
              label={group.label}
              bookmarks={group.bookmarks}
              creations={group.creations}
              onDelete={(id) => deleteBookmark.mutate({ id })}
            />
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-1" />

      {isFetchingNextPage && (
        <div className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-3 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <BookmarkCardSkeleton key={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function BookmarkGroupSection({
  label,
  bookmarks,
  creations,
  onDelete,
}: {
  label: string;
  bookmarks: Bookmark[];
  creations: BookmarkCreation[];
  onDelete: (id: string) => void;
}) {
  const canReorder = resolveCanSortBookmarkList(bookmarks);
  const grid = (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
      data-testid="bookmark-grid"
    >
      <BookmarkCreationCards creations={creations} />
      {bookmarks.map((bookmark) =>
        canReorder ? (
          <SortableBookmarkCard
            key={bookmark.id}
            bookmark={bookmark}
            onDelete={() => onDelete(bookmark.id)}
          />
        ) : (
          <DraggableBookmarkCard
            key={bookmark.id}
            bookmark={bookmark}
            onDelete={() => onDelete(bookmark.id)}
          />
        ),
      )}
    </div>
  );

  return (
    <section data-testid={`bookmark-group-${label}`}>
      <h2 className="mb-3 border-b border-gray-200 pb-2 text-sm font-semibold text-gray-700">
        {label}
      </h2>
      {canReorder ? (
        <SortableContext
          items={bookmarks.map((bookmark) => bookmark.id)}
          strategy={rectSortingStrategy}
        >
          {grid}
        </SortableContext>
      ) : (
        grid
      )}
    </section>
  );
}

function BookmarkCreationCards({ creations }: { creations: BookmarkCreation[] }) {
  if (creations.length === 0) return null;

  return (
    <>
      {creations.map((creation) => (
        <div key={creation.clientId} data-testid={`bookmark-creation-${creation.status}`}>
          {creation.status === 'success' ? (
            <BookmarkCardPreview bookmark={creation.bookmark} />
          ) : (
            <div
              className={`flex h-full flex-col overflow-hidden rounded-lg border bg-white ${
                creation.status === 'error' ? 'border-red-300' : 'border-blue-300'
              }`}
            >
              <div
                className={`flex aspect-[1.91/1] items-center justify-center ${
                  creation.status === 'error'
                    ? 'bg-red-50 text-red-400'
                    : 'bg-blue-50 text-blue-500'
                }`}
              >
                {creation.status === 'pending' ? (
                  <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <span className="text-2xl" aria-hidden="true">
                    !
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p
                  className={`text-sm font-medium ${
                    creation.status === 'error' ? 'text-red-700' : 'text-blue-700'
                  }`}
                >
                  {creation.status === 'pending' ? '情報を取得中' : '追加できませんでした'}
                </p>
                {creation.status === 'error' && (
                  <p className="text-xs text-red-600">{creation.error}</p>
                )}
                <p className="mt-auto truncate text-xs text-gray-500">{creation.url}</p>
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function LoadingSkeleton() {
  return (
    <>
      {[...Array(6)].map((_, i) => (
        <BookmarkCardSkeleton key={i} testId="bookmark-loading-skeleton" />
      ))}
    </>
  );
}

function EmptyState() {
  return (
    <div className="py-12 text-center text-gray-400">
      <p className="text-lg">ブックマークはありません</p>
    </div>
  );
}

function SortableBookmarkCard({
  bookmark,
  onDelete,
}: {
  bookmark: Bookmark;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: bookmark.id,
    data: { type: 'bookmark', bookmark },
  });

  // drag 中はカード本体を不可視にし、DragOverlay 側のサムネイルだけを表示する。
  // レイアウト枠は残すことで同一 SortableContext の reorder preview を維持する。
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-0' : ''}>
      <BookmarkCard
        bookmark={bookmark}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
        dragHandleLabel="並び替え・フォルダ移動"
        dragHandleRef={setActivatorNodeRef}
      />
    </div>
  );
}

function DraggableBookmarkCard({
  bookmark,
  onDelete,
}: {
  bookmark: Bookmark;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: bookmark.id,
    data: { type: 'bookmark', bookmark },
  });

  return (
    <div ref={setNodeRef} className={isDragging ? 'opacity-0' : ''}>
      <BookmarkCard
        bookmark={bookmark}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
        dragHandleLabel="フォルダ移動"
        dragHandleRef={setActivatorNodeRef}
      />
    </div>
  );
}

export function BookmarkCardPreview({ bookmark }: { bookmark: Bookmark }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
      <BookmarkCardContent bookmark={bookmark} />
    </div>
  );
}

function BookmarkCard({
  bookmark,
  onDelete,
  dragHandleProps,
  dragHandleLabel,
  dragHandleRef,
}: {
  bookmark: Bookmark;
  onDelete: () => void;
  dragHandleProps: Record<string, unknown>;
  dragHandleLabel: string;
  dragHandleRef: RefCallback<HTMLButtonElement>;
}) {
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 transition-colors hover:border-gray-300 hover:bg-gray-50">
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 flex-col"
              data-testid={`bookmark-card-${bookmark.id}`}
            >
              <BookmarkCardContent bookmark={bookmark} />
            </a>
            <button
              ref={dragHandleRef}
              type="button"
              className="absolute top-0 right-0 flex h-11 w-11 touch-none cursor-grab items-center justify-center bg-black/50 text-white opacity-100 transition-opacity hover:bg-black/70 active:cursor-grabbing md:top-1 md:right-1 md:h-auto md:w-auto md:rounded md:p-1 md:opacity-0 md:group-hover:opacity-100"
              {...dragHandleProps}
              aria-label={dragHandleLabel}
              data-testid={`bookmark-drag-handle-${bookmark.id}`}
            >
              <GripIcon />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onDelete();
              }}
              className="absolute top-0 left-0 flex h-11 w-11 items-center justify-center bg-black/50 text-white opacity-100 transition-opacity hover:bg-black/70 md:top-1 md:left-1 md:h-auto md:w-auto md:rounded md:p-1 md:opacity-0 md:group-hover:opacity-100"
              aria-label="削除"
            >
              <TrashIcon />
            </button>
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="z-50 min-w-[160px] rounded-md border border-gray-200 bg-white py-1 shadow-lg">
            <ContextMenu.Item
              className="cursor-default px-3 py-1.5 text-sm text-gray-700 outline-none hover:bg-gray-100 data-[highlighted]:bg-gray-100"
              onSelect={() => setMoveDialogOpen(true)}
            >
              移動
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      <MoveBookmarkDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        bookmark={bookmark}
      />
    </>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="5" cy="3" r="1.5" />
      <circle cx="11" cy="3" r="1.5" />
      <circle cx="5" cy="8" r="1.5" />
      <circle cx="11" cy="8" r="1.5" />
      <circle cx="5" cy="13" r="1.5" />
      <circle cx="11" cy="13" r="1.5" />
    </svg>
  );
}
