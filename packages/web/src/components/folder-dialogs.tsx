import * as Dialog from '@radix-ui/react-dialog';
import { useId, useState } from 'react';

import {
  FOLDER_NAME_MAX_LENGTH,
  validateFolderName,
  type FolderNameValidationError,
} from '@bkmk/api/folder-name-validation';

import { useCreateFolder } from '../hooks/use-create-folder';
import { useMoveBookmark } from '../hooks/use-move-bookmark';
import { useMoveFolder } from '../hooks/use-move-folder';
import { useRenameFolder } from '../hooks/use-rename-folder';
import type { Bookmark, Folder } from '../types';
import { MoveTargetRow, MoveTargetTree } from './move-target-tree';

const FOLDER_NAME_ERROR_MESSAGES: Record<FolderNameValidationError, string> = {
  'invalid-length': `フォルダ名は${FOLDER_NAME_MAX_LENGTH}文字以内で入力してください。`,
  'surrounding-whitespace': 'フォルダ名の先頭と末尾の空白を削除してください。',
  'invalid-character':
    '使用できる文字は、英数字（アクセント付き文字を含む）、日本語、絵文字、ピリオド、ハイフン、アンダースコア、空白、アンパサンド（&）です。',
};

function getFolderNameErrorMessage(name: string): string | null {
  if (name.length === 0) {
    return 'フォルダ名を入力してください。';
  }
  const error = validateFolderName(name);
  return error ? FOLDER_NAME_ERROR_MESSAGES[error] : null;
}

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
  const [hasInteracted, setHasInteracted] = useState(false);
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const createFolder = useCreateFolder();
  const validationError = getFolderNameErrorMessage(name);
  const displayedError =
    (hasInteracted ? validationError : null) ??
    (createFolder.isError ? createFolder.error.message : null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHasInteracted(true);
    if (validationError) return;

    const path = parentPath ? `${parentPath}/${name}` : `/${name}`;
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
            <label htmlFor={inputId} className="sr-only">
              フォルダ名
            </label>
            <input
              id={inputId}
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setHasInteracted(true);
              }}
              placeholder="フォルダ名"
              aria-invalid={displayedError ? true : undefined}
              aria-describedby={displayedError ? errorId : undefined}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />

            {displayedError && (
              <p id={errorId} role="alert" className="mt-2 text-sm text-red-600">
                {displayedError}
              </p>
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
                disabled={validationError !== null || createFolder.isPending}
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
  const [hasInteracted, setHasInteracted] = useState(false);
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const renameFolder = useRenameFolder({ selectedFolder, onSelectFolder });
  const validationError = getFolderNameErrorMessage(name);
  const displayedError =
    (hasInteracted ? validationError : null) ??
    (renameFolder.isError ? renameFolder.error.message : null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHasInteracted(true);
    if (validationError || name === folder.name) return;

    renameFolder.mutate(
      { id: folder.id, name },
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
            <label htmlFor={inputId} className="sr-only">
              フォルダ名
            </label>
            <input
              id={inputId}
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setHasInteracted(true);
              }}
              placeholder="フォルダ名"
              aria-invalid={displayedError ? true : undefined}
              aria-describedby={displayedError ? errorId : undefined}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />

            {displayedError && (
              <p id={errorId} role="alert" className="mt-2 text-sm text-red-600">
                {displayedError}
              </p>
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
                disabled={
                  validationError !== null || name === folder.name || renameFolder.isPending
                }
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
