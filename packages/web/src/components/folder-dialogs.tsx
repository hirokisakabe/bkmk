import * as Dialog from '@radix-ui/react-dialog';
import { useMemo, useState } from 'react';

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
  onMoved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: Folder;
  onMoved?: () => void;
}) {
  const [selectedParent, setSelectedParent] = useState<string | null>(folder.parentPath);
  const [searchQuery, setSearchQuery] = useState('');
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
            <MoveBookmarkTree
              selectedFolder={selectedFolder}
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

function MoveBookmarkTree({
  selectedFolder,
  onSelect,
  searchQuery,
}: {
  selectedFolder: string | null;
  onSelect: (path: string | null) => void;
  searchQuery: string;
}) {
  const { data: allFolders } = useAllFolders();
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());

  const hasChildren = useMemo(() => {
    if (!allFolders) return new Set<string | null>();
    const set = new Set<string | null>();
    for (const f of allFolders) {
      set.add(f.parentPath);
    }
    return set;
  }, [allFolders]);

  const isSearching = searchQuery.trim().length > 0;
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visiblePaths = useMemo(() => {
    if (!isSearching || !allFolders) return null;
    const matched = allFolders.filter((f) => f.name.toLowerCase().includes(normalizedQuery));
    const visible = new Set<string>();
    for (const f of matched) {
      visible.add(f.path);
      for (const ancestor of getAncestorPaths(f.path)) {
        visible.add(ancestor);
      }
    }
    return visible;
  }, [allFolders, isSearching, normalizedQuery]);

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  if (!allFolders) return null;

  const renderTree = (parentPath: string | null, depth: number): React.ReactNode[] => {
    const children = getChildFolders(allFolders, parentPath);
    const nodes: React.ReactNode[] = [];

    for (const f of children) {
      if (isSearching && visiblePaths && !visiblePaths.has(f.path)) continue;

      const isExpanded = isSearching || expandedPaths.has(f.path);
      const hasSub = hasChildren.has(f.path);

      nodes.push(
        <div key={f.id} className="flex w-full items-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(f.path);
            }}
            className="flex shrink-0 items-center justify-center text-gray-400"
            style={{ width: '20px', marginLeft: `${depth * 16 + 8}px` }}
            tabIndex={-1}
          >
            {hasSub && !isSearching && <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>}
          </button>
          <button
            type="button"
            onClick={() => onSelect(f.path)}
            className={`min-w-0 flex-1 py-2 pr-3 text-left text-sm ${
              selectedFolder === f.path
                ? 'bg-blue-100 font-semibold text-blue-800'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {f.name}
          </button>
        </div>,
      );

      if (isExpanded) {
        nodes.push(...renderTree(f.path, depth + 1));
      }
    }

    return nodes;
  };

  return <>{renderTree(null, 0)}</>;
}

function getAncestorPaths(path: string): string[] {
  const parts = path.split('/').filter(Boolean);
  const ancestors: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    ancestors.push('/' + parts.slice(0, i).join('/'));
  }
  return ancestors;
}

function MoveFolderTree({
  excludePath,
  selectedParent,
  onSelect,
  searchQuery,
}: {
  excludePath: string;
  selectedParent: string | null;
  onSelect: (path: string | null) => void;
  searchQuery: string;
}) {
  const { data: allFolders } = useAllFolders();
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());

  const filtered = useMemo(() => {
    if (!allFolders) return [];
    return allFolders.filter(
      (f) => f.path !== excludePath && !f.path.startsWith(excludePath + '/'),
    );
  }, [allFolders, excludePath]);

  const hasChildren = useMemo(() => {
    const set = new Set<string | null>();
    for (const f of filtered) {
      set.add(f.parentPath);
    }
    return set;
  }, [filtered]);

  const isSearching = searchQuery.trim().length > 0;
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visiblePaths = useMemo(() => {
    if (!isSearching) return null;
    const matched = filtered.filter((f) => f.name.toLowerCase().includes(normalizedQuery));
    const visible = new Set<string>();
    for (const f of matched) {
      visible.add(f.path);
      for (const ancestor of getAncestorPaths(f.path)) {
        visible.add(ancestor);
      }
    }
    return visible;
  }, [filtered, isSearching, normalizedQuery]);

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  if (!allFolders) return null;

  const renderTree = (parentPath: string | null, depth: number): React.ReactNode[] => {
    const children = getChildFolders(filtered, parentPath);
    const nodes: React.ReactNode[] = [];

    for (const f of children) {
      if (isSearching && visiblePaths && !visiblePaths.has(f.path)) continue;

      const isExpanded = isSearching || expandedPaths.has(f.path);
      const hasSub = hasChildren.has(f.path);

      nodes.push(
        <div key={f.id} className="flex w-full items-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(f.path);
            }}
            className="flex shrink-0 items-center justify-center text-gray-400"
            style={{ width: '20px', marginLeft: `${depth * 16 + 8}px` }}
            tabIndex={-1}
          >
            {hasSub && !isSearching && <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>}
          </button>
          <button
            type="button"
            onClick={() => onSelect(f.path)}
            className={`min-w-0 flex-1 py-2 pr-3 text-left text-sm ${
              selectedParent === f.path
                ? 'bg-blue-100 font-semibold text-blue-800'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {f.name}
          </button>
        </div>,
      );

      if (isExpanded) {
        nodes.push(...renderTree(f.path, depth + 1));
      }
    }

    return nodes;
  };

  return <>{renderTree(null, 0)}</>;
}
