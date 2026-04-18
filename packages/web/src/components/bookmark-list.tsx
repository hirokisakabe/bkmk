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
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useState } from 'react';

import { useBookmarks } from '../hooks/use-bookmarks';
import { useDeleteBookmark } from '../hooks/use-delete-bookmark';
import { useReorderBookmark } from '../hooks/use-reorder-bookmark';
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
  const deep = folderPath !== null && settings.includeSubfolders;
  const { data: bookmarks, isLoading } = useBookmarks(folderPath, deep);
  const reorderBookmark = useReorderBookmark();
  const [deleteTarget, setDeleteTarget] = useState<Bookmark | null>(null);

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
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">{folderName}</h2>
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
                <SortableBookmarkCard
                  key={bookmark.id}
                  bookmark={bookmark}
                  onDelete={() => setDeleteTarget(bookmark)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {!isLoading && bookmarks && bookmarks.length > 0 && !canReorder && (
        <div className="space-y-3">
          {bookmarks.map((bookmark) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              onDelete={() => setDeleteTarget(bookmark)}
            />
          ))}
        </div>
      )}

      <DeleteBookmarkDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} />
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
          <BookmarkCard bookmark={bookmark} onDelete={onDelete} />
        </div>
      </div>
    </div>
  );
}

function BookmarkCard({ bookmark, onDelete }: { bookmark: Bookmark; onDelete: () => void }) {
  const [imageError, setImageError] = useState(false);
  const displayTitle = bookmark.title || bookmark.url;

  return (
    <div className="group relative rounded-lg border border-gray-200 transition-colors hover:border-gray-300 hover:bg-gray-50">
      <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className="block p-4">
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
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-2 right-2 rounded p-1 text-gray-400 opacity-100 transition-opacity hover:bg-gray-200 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100"
        aria-label="削除"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

function DeleteBookmarkDialog({
  target,
  onClose,
}: {
  target: Bookmark | null;
  onClose: () => void;
}) {
  const deleteBookmark = useDeleteBookmark();

  const handleDelete = () => {
    if (!target) return;
    deleteBookmark.mutate({ id: target.id }, { onSuccess: onClose });
  };

  const name = target ? target.title || target.url : '';

  return (
    <AlertDialog.Root open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
          <AlertDialog.Title className="mb-2 text-lg font-bold">
            ブックマークを削除
          </AlertDialog.Title>
          <AlertDialog.Description className="mb-4 text-sm text-gray-500">
            「{name}」をゴミ箱に移動します。ゴミ箱から復元できます。
          </AlertDialog.Description>

          {deleteBookmark.isError && (
            <p className="mb-4 text-sm text-red-600">{deleteBookmark.error.message}</p>
          )}

          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <button
                type="button"
                className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
              >
                キャンセル
              </button>
            </AlertDialog.Cancel>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteBookmark.isPending}
              className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteBookmark.isPending ? '削除中...' : '削除'}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
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
