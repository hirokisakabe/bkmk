import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { createRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { Layout } from '../components/layout';
import { OverflowTooltip } from '../components/overflow-tooltip';
import { useDeleteTrashItem } from '../hooks/use-delete-trash-item';
import { useEmptyTrash } from '../hooks/use-empty-trash';
import { useRestoreTrashItem } from '../hooks/use-restore-trash-item';
import { useTrash } from '../hooks/use-trash';
import { requireAuth } from '../lib/auth-guard';
import type { Bookmark, Folder } from '../types';
import { rootRoute } from './__root';

export const trashRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trash',
  beforeLoad: requireAuth,
  component: TrashPage,
});

type TrashItem = { type: 'folder'; data: Folder } | { type: 'bookmark'; data: Bookmark };

function TrashPage() {
  const { data, isLoading, isError } = useTrash();
  const [deleteTarget, setDeleteTarget] = useState<TrashItem | null>(null);
  const [emptyDialogOpen, setEmptyDialogOpen] = useState(false);

  const items: TrashItem[] = [];
  if (data) {
    for (const f of data.folders) {
      items.push({ type: 'folder', data: f });
    }
    for (const b of data.bookmarks) {
      items.push({ type: 'bookmark', data: b });
    }
    items.sort((a, b) => {
      const da = a.data.deletedAt ?? '';
      const db = b.data.deletedAt ?? '';
      return da < db ? -1 : da > db ? 1 : 0;
    });
  }

  return (
    <Layout>
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">ゴミ箱</h2>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setEmptyDialogOpen(true)}
              className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
            >
              ゴミ箱を空にする
            </button>
          )}
        </div>

        {isLoading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg border border-gray-200 p-4">
                <div className="space-y-2">
                  <div className="h-4 w-3/4 rounded bg-gray-200" />
                  <div className="h-3 w-1/2 rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && isError && (
          <div className="py-12 text-center text-red-500">
            <p className="text-lg">ゴミ箱の取得に失敗しました</p>
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            <p className="text-lg">ゴミ箱にアイテムはありません</p>
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <div className="space-y-3">
            {items.map((item) => (
              <TrashItemCard
                key={item.data.id}
                item={item}
                onDelete={() => setDeleteTarget(item)}
              />
            ))}
          </div>
        )}
      </div>

      <DeleteItemDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} />
      <EmptyTrashDialog open={emptyDialogOpen} onOpenChange={setEmptyDialogOpen} />
    </Layout>
  );
}

function TrashItemCard({ item, onDelete }: { item: TrashItem; onDelete: () => void }) {
  const restoreItem = useRestoreTrashItem();
  const isFolder = item.type === 'folder';
  const name = isFolder ? item.data.name : item.data.title || item.data.url;
  const deletedAt = item.data.deletedAt
    ? new Date(item.data.deletedAt).toLocaleString('ja-JP')
    : '';

  return (
    <div className="flex min-w-0 items-center justify-between rounded-lg border border-gray-200 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          {isFolder ? <FolderIcon /> : <BookmarkIcon />}
          {isFolder ? (
            <OverflowTooltip text={name}>
              {({ isOverflowing, textRef, triggerProps }) => (
                <span
                  ref={textRef}
                  className="min-w-0 flex-1 truncate rounded-sm font-medium text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  tabIndex={isOverflowing ? 0 : undefined}
                  {...triggerProps}
                >
                  {name}
                </span>
              )}
            </OverflowTooltip>
          ) : (
            <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{name}</span>
          )}
        </div>
        {item.type === 'bookmark' && (
          <p className="mt-1 truncate pl-6 text-xs text-gray-400">{item.data.url}</p>
        )}
        <p className="mt-1 pl-6 text-xs text-gray-400">削除日時: {deletedAt}</p>
      </div>

      <div className="ml-4 flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => restoreItem.mutate({ id: item.data.id })}
          disabled={restoreItem.isPending}
          className="rounded px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-50"
        >
          {restoreItem.isPending ? '復元中...' : '復元'}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
        >
          完全削除
        </button>
      </div>
    </div>
  );
}

function DeleteItemDialog({ target, onClose }: { target: TrashItem | null; onClose: () => void }) {
  const deleteItem = useDeleteTrashItem();

  const handleDelete = () => {
    if (!target) return;
    deleteItem.mutate({ id: target.data.id }, { onSuccess: onClose });
  };

  const name =
    target?.type === 'folder'
      ? target.data.name
      : target
        ? target.data.title || target.data.url
        : '';

  return (
    <AlertDialog.Root open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
          <AlertDialog.Title className="mb-2 text-lg font-bold">完全削除</AlertDialog.Title>
          <AlertDialog.Description className="mb-4 text-sm text-gray-500">
            「{name}」を完全に削除します。この操作は取り消せません。
          </AlertDialog.Description>

          {deleteItem.isError && (
            <p className="mb-4 text-sm text-red-600">{deleteItem.error.message}</p>
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
              disabled={deleteItem.isPending}
              className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteItem.isPending ? '削除中...' : '完全削除'}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

function EmptyTrashDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const emptyTrash = useEmptyTrash();

  const handleEmpty = () => {
    emptyTrash.mutate(undefined, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
          <AlertDialog.Title className="mb-2 text-lg font-bold">ゴミ箱を空にする</AlertDialog.Title>
          <AlertDialog.Description className="mb-4 text-sm text-gray-500">
            ゴミ箱内のすべてのアイテムを完全に削除します。この操作は取り消せません。
          </AlertDialog.Description>

          {emptyTrash.isError && (
            <p className="mb-4 text-sm text-red-600">{emptyTrash.error.message}</p>
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
              onClick={handleEmpty}
              disabled={emptyTrash.isPending}
              className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            >
              {emptyTrash.isPending ? '削除中...' : 'すべて完全削除'}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

function FolderIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
      <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
    </svg>
  );
}
