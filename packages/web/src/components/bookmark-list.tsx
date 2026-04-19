import { useDraggable } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';

import { useBookmarks } from '../hooks/use-bookmarks';
import { useDeleteBookmark } from '../hooks/use-delete-bookmark';
import { UNCATEGORIZED_FOLDER } from '../lib/constants';
import { useSettings } from '../lib/settings-store';
import type { Bookmark } from '../types';
import { AddBookmarkForm } from './add-bookmark-form';

export function BookmarkList({
  folderPath,
  folderName,
}: {
  folderPath: string | null;
  folderName: string;
}) {
  const [settings] = useSettings();
  const isUncategorized = folderPath === UNCATEGORIZED_FOLDER;
  const isAllBookmarks = folderPath === null;
  const apiFolderPath = isUncategorized ? null : folderPath;
  const deep = isAllBookmarks
    ? true
    : !isUncategorized && folderPath !== null && settings.includeSubfolders;
  const { data: bookmarks, isLoading } = useBookmarks(apiFolderPath, deep);
  const deleteBookmark = useDeleteBookmark();

  const canReorder = !deep && !isAllBookmarks && bookmarks && bookmarks.length > 1;
  const addBookmarkFolderPath = isUncategorized ? null : folderPath;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">{folderName}</h2>
      </div>

      <AddBookmarkForm folderPath={addBookmarkFolderPath} />

      {isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
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

      {!isLoading && bookmarks?.length === 0 && (
        <div className="py-12 text-center text-gray-400">
          <p className="text-lg">ブックマークはありません</p>
        </div>
      )}

      {!isLoading && bookmarks && bookmarks.length > 0 && canReorder && (
        <SortableContext items={bookmarks.map((b) => b.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {bookmarks.map((bookmark) => (
              <SortableBookmarkCard
                key={bookmark.id}
                bookmark={bookmark}
                onDelete={() => deleteBookmark.mutate({ id: bookmark.id })}
              />
            ))}
          </div>
        </SortableContext>
      )}

      {!isLoading && bookmarks && bookmarks.length > 0 && !canReorder && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {bookmarks.map((bookmark) => (
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'relative z-10 opacity-50' : ''}>
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
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: bookmark.id,
    data: { type: 'bookmark', bookmark },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'relative z-10 opacity-50' : ''}>
      <BookmarkCard
        bookmark={bookmark}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
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
  const displayTitle = bookmark.title || bookmark.url;
  const showImage = bookmark.imageUrl && !imageError;

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 transition-colors hover:border-gray-300 hover:bg-gray-50">
      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-1 flex-col"
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
          className="absolute top-1 right-1 cursor-grab rounded bg-black/50 p-1 text-white opacity-100 transition-opacity hover:bg-black/70 active:cursor-grabbing md:opacity-0 md:group-hover:opacity-100"
          aria-label="並び替え"
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
        className="absolute top-1 left-1 rounded bg-black/50 p-1 text-white opacity-100 transition-opacity hover:bg-black/70 md:opacity-0 md:group-hover:opacity-100"
        aria-label="削除"
      >
        <TrashIcon />
      </button>
    </div>
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
