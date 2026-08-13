import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';

import { useCreateFolder } from '../hooks/use-create-folder';
import { useMoveBookmark } from '../hooks/use-move-bookmark';
import { useMoveFolder } from '../hooks/use-move-folder';
import { useRenameFolder } from '../hooks/use-rename-folder';
import type { Bookmark, Folder } from '../types';
import { MoveTargetRow, MoveTargetTree } from './move-target-tree';

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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
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
  selectedFolder,
  onSelectFolder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: Folder;
  selectedFolder: string | null;
  onSelectFolder: (path: string | null) => void;
}) {
  const [name, setName] = useState(folder.name);
  const renameFolder = useRenameFolder({ selectedFolder, onSelectFolder });

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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
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
  selectedFolder,
  onSelectFolder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: Folder;
  selectedFolder: string | null;
  onSelectFolder: (path: string | null) => void;
}) {
  const [selectedParent, setSelectedParent] = useState<string | null>(folder.parentPath);
  const [searchQuery, setSearchQuery] = useState('');
  const moveFolder = useMoveFolder({ selectedFolder, onSelectFolder });

  const handleMove = () => {
    if (selectedParent === folder.parentPath) return;

    moveFolder.mutate(
      { id: folder.id, parentPath: selectedParent },
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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
          <Dialog.Title className="mb-4 text-lg font-bold">フォルダの移動</Dialog.Title>

          <p className="mb-3 text-sm text-gray-500">「{folder.name}」の移動先を選択してください</p>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="フォルダを検索..."
            className="mb-2 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />

          <div className="max-h-64 overflow-y-auto rounded border border-gray-200">
            <MoveTargetRow
              label="ルート"
              path={null}
              selected={selectedParent === null}
              onSelect={setSelectedParent}
            />
            <MoveTargetTree
              excludePath={folder.path}
              selectedPath={selectedParent}
              onSelect={setSelectedParent}
              searchQuery={searchQuery}
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
  const [searchQuery, setSearchQuery] = useState('');
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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
          <Dialog.Title className="mb-4 text-lg font-bold">ブックマークの移動</Dialog.Title>

          <p className="mb-3 text-sm text-gray-500">
            「{bookmark.title || bookmark.url}」の移動先を選択してください
          </p>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="フォルダを検索..."
            className="mb-2 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />

          <div className="max-h-64 overflow-y-auto rounded border border-gray-200">
            <MoveTargetRow
              label="未分類"
              path={null}
              selected={selectedFolder === null}
              onSelect={setSelectedFolder}
            />
            <MoveTargetTree
              selectedPath={selectedFolder}
              onSelect={setSelectedFolder}
              searchQuery={searchQuery}
            />
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
