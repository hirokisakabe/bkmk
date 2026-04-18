import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';

import { useBookmarks } from '../hooks/use-bookmarks';
import { useReorderBookmark } from '../hooks/use-reorder-bookmark';
import type { Bookmark } from '../types';
import { AddBookmarkForm } from './add-bookmark-form';

export function BookmarkList({
  folderPath,
  folderName,
  deep,
  onToggleDeep,
}: {
  folderPath: string | null;
  folderName: string;
  deep: boolean;
  onToggleDeep: (deep: boolean) => void;
}) {
  const { data: bookmarks, isLoading } = useBookmarks(folderPath, deep);
  const reorderBookmark = useReorderBookmark();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (reorderBookmark.isPending) return;

    const { active, over } = event;
    if (!over || active.id === over.id || !bookmarks) return;

    const oldIndex = bookmarks.findIndex((b) => b.id === active.id);
    const newIndex = bookmarks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    reorderBookmark.mutate({
      id: bookmarks[oldIndex].id,
      position: bookmarks[newIndex].position,
    });
  };

  const canReorder = !deep && bookmarks && bookmarks.length > 1;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">{folderName}</h2>
        {folderPath !== null && (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={deep}
              onChange={(e) => onToggleDeep(e.target.checked)}
              className="rounded border-gray-300"
            />
            サブフォルダを含む
          </label>
        )}
      </div>

      <AddBookmarkForm folderPath={folderPath} />

      {isLoading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-gray-200 p-4">
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-gray-200" />
                  <div className="h-3 w-full rounded bg-gray-200" />
                  <div className="h-3 w-1/2 rounded bg-gray-200" />
                </div>
                <div className="h-20 w-32 shrink-0 rounded bg-gray-200" />
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={bookmarks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {bookmarks.map((bookmark) => (
                <SortableBookmarkCard key={bookmark.id} bookmark={bookmark} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {!isLoading && bookmarks && bookmarks.length > 0 && !canReorder && (
        <div className="space-y-3">
          {bookmarks.map((bookmark) => (
            <BookmarkCard key={bookmark.id} bookmark={bookmark} />
          ))}
        </div>
      )}
    </div>
  );
}

function SortableBookmarkCard({ bookmark }: { bookmark: Bookmark }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bookmark.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'relative z-10 opacity-50' : ''}>
      <div className="flex items-stretch">
        <button
          type="button"
          className="flex w-6 shrink-0 cursor-grab items-center justify-center text-gray-300 hover:text-gray-500 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripIcon />
        </button>
        <div className="min-w-0 flex-1">
          <BookmarkCard bookmark={bookmark} />
        </div>
      </div>
    </div>
  );
}

function BookmarkCard({ bookmark }: { bookmark: Bookmark }) {
  const [imageError, setImageError] = useState(false);
  const displayTitle = bookmark.title || bookmark.url;

  return (
    <a
      href={bookmark.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-gray-200 p-4 transition-colors hover:border-gray-300 hover:bg-gray-50"
    >
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
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
            <h3 className="truncate font-medium text-gray-900">{displayTitle}</h3>
          </div>

          {bookmark.description && (
            <p className="mb-1 line-clamp-2 text-sm text-gray-500">{bookmark.description}</p>
          )}

          <p className="truncate text-xs text-gray-400">{bookmark.url}</p>
        </div>

        {bookmark.imageUrl && !imageError && (
          <img
            src={bookmark.imageUrl}
            alt=""
            className="h-20 w-32 shrink-0 rounded object-cover"
            onError={() => setImageError(true)}
          />
        )}
      </div>
    </a>
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
