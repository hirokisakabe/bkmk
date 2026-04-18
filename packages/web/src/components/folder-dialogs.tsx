import * as AlertDialog from '@radix-ui/react-alert-dialog';
import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';

import { useCreateFolder } from '../hooks/use-create-folder';
import { useDeleteFolder } from '../hooks/use-delete-folder';
import { useFolders } from '../hooks/use-folders';
import { useMoveFolder } from '../hooks/use-move-folder';
import { useRenameFolder } from '../hooks/use-rename-folder';
import type { Folder } from '../types';

/* ------------------------------------------------------------------ */
/*  CreateFolderDialog                                                 */
/* ------------------------------------------------------------------ */

export function CreateFolderDialog({
  open,
  onOpenChange,
  parentPath,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentPath: string | null;
}) {
  const [name, setName] = useState('');
  const createFolder = useCreateFolder();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    const path = parentPath ? `${parentPath}/${trimmed}` : `/${trimmed}`;
    createFolder.mutate(
      { path },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
          <Dialog.Title className="mb-4 text-lg font-bold">新しいフォルダ</Dialog.Title>

          <form onSubmit={handleSubmit}>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="フォルダ名"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />

            {createFolder.isError && (
              <p className="mt-2 text-sm text-red-600">{createFolder.error.message}</p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                >
                  キャンセル
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={!name.trim() || createFolder.isPending}
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {createFolder.isPending ? '作成中...' : '作成'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ------------------------------------------------------------------ */
/*  RenameFolderDialog                                                 */
/* ------------------------------------------------------------------ */

export function RenameFolderDialog({
  open,
  onOpenChange,
  folder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: Folder;
}) {
  const [name, setName] = useState(folder.name);
  const renameFolder = useRenameFolder();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === folder.name) return;

    renameFolder.mutate(
      { id: folder.id, name: trimmed },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
          <Dialog.Title className="mb-4 text-lg font-bold">フォルダ名の変更</Dialog.Title>

          <form onSubmit={handleSubmit}>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="フォルダ名"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />

            {renameFolder.isError && (
              <p className="mt-2 text-sm text-red-600">{renameFolder.error.message}</p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                >
                  キャンセル
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={!name.trim() || name.trim() === folder.name || renameFolder.isPending}
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {renameFolder.isPending ? '変更中...' : '変更'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ------------------------------------------------------------------ */
/*  MoveFolderDialog                                                   */
/* ------------------------------------------------------------------ */

export function MoveFolderDialog({
  open,
  onOpenChange,
  folder,
  onMoved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: Folder;
  onMoved?: () => void;
}) {
  const [selectedParent, setSelectedParent] = useState<string | null>(folder.parentPath);
  const moveFolder = useMoveFolder();

  const handleMove = () => {
    if (selectedParent === folder.parentPath) return;

    moveFolder.mutate(
      { id: folder.id, parentPath: selectedParent },
      {
        onSuccess: () => {
          onOpenChange(false);
          onMoved?.();
        },
      },
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
          <Dialog.Title className="mb-4 text-lg font-bold">フォルダの移動</Dialog.Title>

          <p className="mb-3 text-sm text-gray-500">「{folder.name}」の移動先を選択してください</p>

          <div className="max-h-64 overflow-y-auto rounded border border-gray-200">
            <button
              type="button"
              onClick={() => setSelectedParent(null)}
              className={`w-full px-3 py-2 text-left text-sm ${
                selectedParent === null
                  ? 'bg-blue-100 font-semibold text-blue-800'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              / (ルート)
            </button>
            <MoveFolderTree
              parentPath={null}
              excludePath={folder.path}
              selectedParent={selectedParent}
              onSelect={setSelectedParent}
              depth={0}
            />
          </div>

          {moveFolder.isError && (
            <p className="mt-2 text-sm text-red-600">{moveFolder.error.message}</p>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
              >
                キャンセル
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={handleMove}
              disabled={selectedParent === folder.parentPath || moveFolder.isPending}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {moveFolder.isPending ? '移動中...' : '移動'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MoveFolderTree({
  parentPath,
  excludePath,
  selectedParent,
  onSelect,
  depth,
}: {
  parentPath: string | null;
  excludePath: string;
  selectedParent: string | null;
  onSelect: (path: string | null) => void;
  depth: number;
}) {
  const { data: folders } = useFolders(parentPath);

  if (!folders) return null;

  const filtered = folders.filter(
    (f) => f.path !== excludePath && !f.path.startsWith(excludePath + '/'),
  );

  return (
    <>
      {filtered.map((f) => (
        <div key={f.id}>
          <button
            type="button"
            onClick={() => onSelect(f.path)}
            className={`w-full px-3 py-2 text-left text-sm ${
              selectedParent === f.path
                ? 'bg-blue-100 font-semibold text-blue-800'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            style={{ paddingLeft: `${(depth + 1) * 16 + 12}px` }}
          >
            {f.name}
          </button>
          <MoveFolderTree
            parentPath={f.path}
            excludePath={excludePath}
            selectedParent={selectedParent}
            onSelect={onSelect}
            depth={depth + 1}
          />
        </div>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  DeleteFolderDialog                                                 */
/* ------------------------------------------------------------------ */

export function DeleteFolderDialog({
  open,
  onOpenChange,
  folder,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: Folder;
  onDeleted?: () => void;
}) {
  const deleteFolder = useDeleteFolder();

  const handleDelete = () => {
    deleteFolder.mutate(
      { id: folder.id },
      {
        onSuccess: () => {
          onOpenChange(false);
          onDeleted?.();
        },
      },
    );
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
          <AlertDialog.Title className="mb-2 text-lg font-bold">フォルダの削除</AlertDialog.Title>
          <AlertDialog.Description className="mb-4 text-sm text-gray-500">
            「{folder.name}
            」とその中のすべてのアイテムがゴミ箱に移動します。この操作は取り消せます。
          </AlertDialog.Description>

          {deleteFolder.isError && (
            <p className="mb-4 text-sm text-red-600">{deleteFolder.error.message}</p>
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
              disabled={deleteFolder.isPending}
              className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteFolder.isPending ? '削除中...' : '削除'}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
