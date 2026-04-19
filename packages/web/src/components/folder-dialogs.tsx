import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';

import { useCreateFolder } from '../hooks/use-create-folder';
import { getChildFolders, useAllFolders } from '../hooks/use-folders';
import { useMoveBookmark } from '../hooks/use-move-bookmark';
import { useMoveFolder } from '../hooks/use-move-folder';
import { useRenameFolder } from '../hooks/use-rename-folder';
import type { Bookmark, Folder } from '../types';

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
              excludePath={folder.path}
              selectedParent={selectedParent}
              onSelect={setSelectedParent}
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

/* ------------------------------------------------------------------ */
/*  MoveBookmarkDialog                                                 */
/* ------------------------------------------------------------------ */

export function MoveBookmarkDialog({
  open,
  onOpenChange,
  bookmark,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmark: Bookmark;
}) {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(bookmark.folderPath);
  const moveBookmark = useMoveBookmark();

  const handleMove = () => {
    if (selectedFolder === bookmark.folderPath) return;

    moveBookmark.mutate(
      { id: bookmark.id, folderPath: selectedFolder },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
          <Dialog.Title className="mb-4 text-lg font-bold">ブックマークの移動</Dialog.Title>

          <p className="mb-3 text-sm text-gray-500">
            「{bookmark.title || bookmark.url}」の移動先を選択してください
          </p>

          <div className="max-h-64 overflow-y-auto rounded border border-gray-200">
            <button
              type="button"
              onClick={() => setSelectedFolder(null)}
              className={`w-full px-3 py-2 text-left text-sm ${
                selectedFolder === null
                  ? 'bg-blue-100 font-semibold text-blue-800'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              未分類
            </button>
            <MoveBookmarkTree selectedFolder={selectedFolder} onSelect={setSelectedFolder} />
          </div>

          {moveBookmark.isError && (
            <p className="mt-2 text-sm text-red-600">{moveBookmark.error.message}</p>
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
              disabled={selectedFolder === bookmark.folderPath || moveBookmark.isPending}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {moveBookmark.isPending ? '移動中...' : '移動'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MoveBookmarkTree({
  selectedFolder,
  onSelect,
}: {
  selectedFolder: string | null;
  onSelect: (path: string | null) => void;
}) {
  const { data: allFolders } = useAllFolders();

  if (!allFolders) return null;

  const treeOrdered = buildTreeOrder(allFolders, null);

  return (
    <>
      {treeOrdered.map((f) => {
        const depth = f.path.split('/').filter(Boolean).length - 1;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onSelect(f.path)}
            className={`w-full px-3 py-2 text-left text-sm ${
              selectedFolder === f.path
                ? 'bg-blue-100 font-semibold text-blue-800'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            style={{ paddingLeft: `${depth * 16 + 28}px` }}
          >
            {f.name}
          </button>
        );
      })}
    </>
  );
}

function buildTreeOrder(allFolders: Folder[], parentPath: string | null): Folder[] {
  const children = getChildFolders(allFolders, parentPath);
  const result: Folder[] = [];
  for (const child of children) {
    result.push(child);
    result.push(...buildTreeOrder(allFolders, child.path));
  }
  return result;
}

function MoveFolderTree({
  excludePath,
  selectedParent,
  onSelect,
}: {
  excludePath: string;
  selectedParent: string | null;
  onSelect: (path: string | null) => void;
}) {
  const { data: allFolders } = useAllFolders();

  if (!allFolders) return null;

  const treeOrdered = buildTreeOrder(allFolders, null).filter(
    (f) => f.path !== excludePath && !f.path.startsWith(excludePath + '/'),
  );

  return (
    <>
      {treeOrdered.map((f) => {
        const depth = f.path.split('/').filter(Boolean).length - 1;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onSelect(f.path)}
            className={`w-full px-3 py-2 text-left text-sm ${
              selectedParent === f.path
                ? 'bg-blue-100 font-semibold text-blue-800'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            style={{ paddingLeft: `${depth * 16 + 28}px` }}
          >
            {f.name}
          </button>
        );
      })}
    </>
  );
}
