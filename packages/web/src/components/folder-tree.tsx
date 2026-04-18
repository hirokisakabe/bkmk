import * as ContextMenu from '@radix-ui/react-context-menu';
import { useState } from 'react';

import { useFolders } from '../hooks/use-folders';
import type { Folder } from '../types';
import {
  CreateFolderDialog,
  DeleteFolderDialog,
  MoveFolderDialog,
  RenameFolderDialog,
} from './folder-dialogs';

type DialogState =
  | { type: 'create'; parentPath: string | null }
  | { type: 'rename'; folder: Folder }
  | { type: 'move'; folder: Folder }
  | { type: 'delete'; folder: Folder }
  | null;

export function FolderTree({
  selectedFolder,
  onSelectFolder,
}: {
  selectedFolder: string | null;
  onSelectFolder: (path: string | null) => void;
}) {
  const { data: folders, isLoading } = useFolders(null);
  const [dialogState, setDialogState] = useState<DialogState>(null);

  const handleDeleteOrMove = (folder: Folder) => {
    if (
      selectedFolder === folder.path ||
      (selectedFolder !== null && selectedFolder.startsWith(folder.path + '/'))
    ) {
      onSelectFolder(null);
    }
  };

  return (
    <nav className="flex-1">
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <button
            type="button"
            className={`w-full rounded px-2 py-1.5 text-left text-sm ${
              selectedFolder === null
                ? 'bg-blue-100 font-semibold text-blue-800'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => onSelectFolder(null)}
          >
            すべて
          </button>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="min-w-[160px] rounded-md border border-gray-200 bg-white py-1 shadow-lg">
            <ContextMenu.Item
              className="cursor-default px-3 py-1.5 text-sm text-gray-700 outline-none hover:bg-gray-100 data-[highlighted]:bg-gray-100"
              onSelect={() => setDialogState({ type: 'create', parentPath: null })}
            >
              新しいフォルダ
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      {isLoading && (
        <div className="mt-2 space-y-2 px-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-5 animate-pulse rounded bg-gray-200" />
          ))}
        </div>
      )}

      {folders?.map((folder) => (
        <FolderTreeNode
          key={folder.id}
          folder={folder}
          selectedFolder={selectedFolder}
          onSelectFolder={onSelectFolder}
          depth={0}
          onAction={setDialogState}
        />
      ))}

      {dialogState?.type === 'create' && (
        <CreateFolderDialog
          open
          onOpenChange={(open) => !open && setDialogState(null)}
          parentPath={dialogState.parentPath}
        />
      )}

      {dialogState?.type === 'rename' && (
        <RenameFolderDialog
          open
          onOpenChange={(open) => !open && setDialogState(null)}
          folder={dialogState.folder}
        />
      )}

      {dialogState?.type === 'move' && (
        <MoveFolderDialog
          open
          onOpenChange={(open) => !open && setDialogState(null)}
          folder={dialogState.folder}
          onMoved={() => handleDeleteOrMove(dialogState.folder)}
        />
      )}

      {dialogState?.type === 'delete' && (
        <DeleteFolderDialog
          open
          onOpenChange={(open) => !open && setDialogState(null)}
          folder={dialogState.folder}
          onDeleted={() => handleDeleteOrMove(dialogState.folder)}
        />
      )}
    </nav>
  );
}

function FolderTreeNode({
  folder,
  selectedFolder,
  onSelectFolder,
  depth,
  onAction,
}: {
  folder: Folder;
  selectedFolder: string | null;
  onSelectFolder: (path: string | null) => void;
  depth: number;
  onAction: (state: DialogState) => void;
}) {
  const isAncestorOfSelected =
    selectedFolder !== null &&
    selectedFolder !== folder.path &&
    selectedFolder.startsWith(folder.path + '/');
  const [expanded, setExpanded] = useState(isAncestorOfSelected);
  const { data: children, isLoading } = useFolders(folder.path, expanded || isAncestorOfSelected);
  const isSelected = selectedFolder === folder.path;
  const hasChildren = children && children.length > 0;

  return (
    <div>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div
            className={`group flex items-center rounded text-sm ${
              isSelected
                ? 'bg-blue-100 font-semibold text-blue-800'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
            style={{ paddingLeft: `${(depth + 1) * 12}px` }}
          >
            <button
              type="button"
              className="flex h-6 w-5 shrink-0 items-center justify-center text-gray-400"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {isLoading ? (
                <Spinner />
              ) : hasChildren || !expanded ? (
                <ChevronIcon expanded={expanded} />
              ) : null}
            </button>

            <button
              type="button"
              className="flex-1 truncate py-1.5 text-left"
              onClick={() => onSelectFolder(folder.path)}
            >
              {folder.name}
            </button>
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="min-w-[160px] rounded-md border border-gray-200 bg-white py-1 shadow-lg">
            <ContextMenu.Item
              className="cursor-default px-3 py-1.5 text-sm text-gray-700 outline-none hover:bg-gray-100 data-[highlighted]:bg-gray-100"
              onSelect={() => onAction({ type: 'create', parentPath: folder.path })}
            >
              新しいフォルダ
            </ContextMenu.Item>
            <ContextMenu.Item
              className="cursor-default px-3 py-1.5 text-sm text-gray-700 outline-none hover:bg-gray-100 data-[highlighted]:bg-gray-100"
              onSelect={() => onAction({ type: 'rename', folder })}
            >
              名前の変更
            </ContextMenu.Item>
            <ContextMenu.Item
              className="cursor-default px-3 py-1.5 text-sm text-gray-700 outline-none hover:bg-gray-100 data-[highlighted]:bg-gray-100"
              onSelect={() => onAction({ type: 'move', folder })}
            >
              移動
            </ContextMenu.Item>
            <ContextMenu.Separator className="my-1 h-px bg-gray-200" />
            <ContextMenu.Item
              className="cursor-default px-3 py-1.5 text-sm text-red-600 outline-none hover:bg-red-50 data-[highlighted]:bg-red-50"
              onSelect={() => onAction({ type: 'delete', folder })}
            >
              削除
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      {expanded &&
        children?.map((child) => (
          <FolderTreeNode
            key={child.id}
            folder={child}
            selectedFolder={selectedFolder}
            onSelectFolder={onSelectFolder}
            depth={depth + 1}
            onAction={onAction}
          />
        ))}
    </div>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
      viewBox="0 0 12 12"
      fill="currentColor"
    >
      <path d="M4.5 2l4 4-4 4V2z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-3 w-3 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
