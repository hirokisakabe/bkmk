import { useDraggable } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useBookmarks, useBookmarksPaginated } from '../hooks/use-bookmarks';
import {
  isBookmarkInScope,
  type BookmarkCreation,
  useBookmarkCreations,
} from '../hooks/use-create-bookmark';
import { useDeleteBookmark } from '../hooks/use-delete-bookmark';
import { useAllFolders } from '../hooks/use-folders';
import { UNCATEGORIZED_FOLDER } from '../lib/constants';
import { resolveCanReorderBookmarks, resolveCanSortBookmarkList } from '../lib/dnd-reorder';
import { useSettings } from '../lib/settings-store';
import type { Bookmark } from '../types';
import { AddBookmarkForm } from './add-bookmark-form';
import { MoveBookmarkDialog } from './folder-dialogs';

export function BookmarkList({
  folderPath,
  folderName,
}: {
  folderPath: string | null;
  folderName: string;
}) {
  const [settings] = useSettings();
  const { data: allFolders = [], isLoading: isFoldersLoading } = useAllFolders();
  const isUncategorized = folderPath === UNCATEGORIZED_FOLDER;
  const isAllBookmarks = folderPath === null;
  const apiFolderPath = isUncategorized ? null : folderPath;
  const deep = isAllBookmarks
    ? true
    : !isUncategorized && folderPath !== null && settings.includeSubfolders;

  // deep=true のときフォルダ一覧未取得中は保守的に「サブフォルダあり」とみなしソートを抑制する
  const hasSubfolders =
    deep && isFoldersLoading ? true : allFolders.some((f) => f.parentPath === folderPath);
  const canReorder = resolveCanReorderBookmarks({ isAllBookmarks, deep, hasSubfolders });
  const addBookmarkFolderPath = isUncategorized ? null : folderPath;

  if (canReorder) {
    return (
      <ReorderableBookmarkList
        folderPath={apiFolderPath}
        folderName={folderName}
        deep={deep}
        addBookmarkFolderPath={addBookmarkFolderPath}
      />
    );
  }

  return (
    <PaginatedBookmarkList
      folderPath={apiFolderPath}
      folderName={folderName}
      deep={deep}
      addBookmarkFolderPath={addBookmarkFolderPath}
    />
  );
}

function ReorderableBookmarkList({
  folderPath,
  folderName,
  deep,
  addBookmarkFolderPath,
}: {
  folderPath: string | null;
  folderName: string;
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
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">{folderName}</h2>
      </div>

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
        currentFolderBookmarks &&
        (currentFolderBookmarks.length > 0 || visibleCreations.length > 0) &&
        !canReorder && (
          <div
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
            data-testid="bookmark-grid"
          >
            <BookmarkCreationCards creations={visibleCreations} />
            {currentFolderBookmarks.map((bookmark) => (
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
  folderName,
  deep,
  addBookmarkFolderPath,
}: {
  folderPath: string | null;
  folderName: string;
  deep: boolean;
  addBookmarkFolderPath: string | null;
}) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useBookmarksPaginated(
    folderPath,
    deep,
  );
  const bookmarks = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);
  const { data: creations = [] } = useBookmarkCreations(bookmarks);
  const deleteBookmark = useDeleteBookmark();

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const visibleCreations = creations.filter(
    (creation) =>
      isBookmarkInScope(creation.folderPath, folderPath, deep) &&
      (creation.status !== 'success' ||
        !bookmarks.some((bookmark) => bookmark.id === creation.bookmark.id)),
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">{folderName}</h2>
      </div>

      <AddBookmarkForm folderPath={addBookmarkFolderPath} />

      {!isLoading && bookmarks.length === 0 && visibleCreations.length === 0 && <EmptyState />}

      {(isLoading || bookmarks.length > 0 || visibleCreations.length > 0) && (
        <div
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
          data-testid="bookmark-grid"
        >
          <BookmarkCreationCards creations={visibleCreations} />
          {isLoading ? (
            <LoadingSkeleton />
          ) : (
            bookmarks.map((bookmark) => (
              <DraggableBookmarkCard
                key={bookmark.id}
                bookmark={bookmark}
                onDelete={() => deleteBookmark.mutate({ id: bookmark.id })}
              />
            ))
          )}
        </div>
      )}

      <div ref={sentinelRef} className="h-1" />

      {isFetchingNextPage && (
        <div className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-3 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse overflow-hidden rounded-lg border border-gray-200"
            >
              <div className="aspect-[1.91/1] overflow-hidden bg-gray-200" />
              <div className="space-y-2 p-3">
                <div className="min-h-[2.5rem]">
                  <div className="h-4 w-3/4 rounded bg-gray-200" />
                </div>
                <div className="h-3 w-full rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
        <div
          key={i}
          className="animate-pulse overflow-hidden rounded-lg border border-gray-200"
          data-testid="bookmark-loading-skeleton"
        >
          <div className="aspect-[1.91/1] overflow-hidden bg-gray-200" />
          <div className="space-y-2 p-3">
            <div className="min-h-[2.5rem]">
              <div className="h-4 w-3/4 rounded bg-gray-200" />
            </div>
            <div className="h-3 w-full rounded bg-gray-200" />
          </div>
        </div>
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
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
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: bookmark.id,
    data: { type: 'bookmark', bookmark },
  });

  return (
    <div
      ref={setNodeRef}
      className={`[touch-action:pan-y] ${isDragging ? 'opacity-0' : ''}`}
      {...attributes}
      {...listeners}
    >
      <BookmarkCard bookmark={bookmark} onDelete={onDelete} />
    </div>
  );
}

export function BookmarkCardPreview({ bookmark }: { bookmark: Bookmark }) {
  const [imageError, setImageError] = useState(false);
  const displayTitle = bookmark.title || bookmark.url;
  const showImage = bookmark.imageUrl && !imageError;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
      <div className="aspect-[1.91/1] w-full overflow-hidden bg-gray-100">
        {showImage ? (
          <img
            src={bookmark.imageUrl!}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <ImagePlaceholderIcon />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <div className="mb-1 flex min-h-[2.5rem] items-center gap-1.5">
          {bookmark.faviconUrl && (
            <img
              src={bookmark.faviconUrl}
              alt=""
              className="h-4 w-4 shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <h3 className="line-clamp-2 text-sm font-medium text-gray-900">{displayTitle}</h3>
        </div>
        {bookmark.description && (
          <p className="line-clamp-2 text-xs text-gray-500">{bookmark.description}</p>
        )}
        <p className="mt-auto truncate text-xs text-gray-400">{bookmark.url}</p>
      </div>
    </div>
  );
}

function BookmarkCard({
  bookmark,
  onDelete,
  dragHandleProps,
}: {
  bookmark: Bookmark;
  onDelete: () => void;
  dragHandleProps?: Record<string, unknown>;
}) {
  const [imageError, setImageError] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const displayTitle = bookmark.title || bookmark.url;
  const showImage = bookmark.imageUrl && !imageError;

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
              <div className="aspect-[1.91/1] w-full overflow-hidden bg-gray-100">
                {showImage ? (
                  <img
                    src={bookmark.imageUrl!}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-300">
                    <ImagePlaceholderIcon />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-3">
                <div className="mb-1 flex min-h-[2.5rem] items-center gap-1.5">
                  {bookmark.faviconUrl && (
                    <img
                      src={bookmark.faviconUrl}
                      alt=""
                      className="h-4 w-4 shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <h3 className="line-clamp-2 text-sm font-medium text-gray-900">{displayTitle}</h3>
                </div>
                {bookmark.description && (
                  <p className="line-clamp-2 text-xs text-gray-500">{bookmark.description}</p>
                )}
                <p className="mt-auto truncate text-xs text-gray-400">{bookmark.url}</p>
              </div>
            </a>
            {dragHandleProps && (
              <button
                type="button"
                className="absolute top-0 right-0 flex h-11 w-11 cursor-grab items-center justify-center bg-black/50 text-white opacity-100 transition-opacity hover:bg-black/70 active:cursor-grabbing md:top-1 md:right-1 md:h-auto md:w-auto md:rounded md:p-1 md:opacity-0 md:group-hover:opacity-100"
                aria-label="並び替え"
                data-testid={`bookmark-drag-handle-${bookmark.id}`}
                {...dragHandleProps}
              >
                <GripIcon />
              </button>
            )}
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

function ImagePlaceholderIcon() {
  return (
    <svg className="h-10 w-10" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
    </svg>
  );
}
