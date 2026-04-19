import { useDndContext, useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { useState } from 'react';

import { useDeleteFolder } from '../hooks/use-delete-folder';
import { getChildFolders, useAllFolders } from '../hooks/use-folders';
import { UNCATEGORIZED_FOLDER } from '../lib/constants';
import type { Folder } from '../types';
import { CreateFolderDialog, MoveFolderDialog, RenameFolderDialog } from './folder-dialogs';

type DialogState =
  | { type: 'create'; parentPath: string | null }
  | { type: 'rename'; folder: Folder }
  | { type: 'move'; folder: Folder }
  | null;

export function FolderTree({
  selectedFolder,
  onSelectFolder,
}: {
  selectedFolder: string | null;
  onSelectFolder: (path: string | null) => void;
}) {
  const { data: allFolders, isLoading } = useAllFolders();
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const deleteFolder = useDeleteFolder();

  const { setNodeRef: rootDropRef, isOver: isOverRoot } = useDroppable({
    id: 'folder-drop-root',
    data: { type: 'folder-root', folderPath: null },
  });
  const { active } = useDndContext();
  const isRootDropTarget = active?.data.current?.type === 'bookmark' && isOverRoot;

  const handleDeleteOrMove = (folder: Folder) => {
    if (
      selectedFolder === folder.path ||
      (selectedFolder !== null && selectedFolder.startsWith(folder.path + '/'))
    ) {
      onSelectFolder(null);
    }
  };

  const handleDelete = (folder: Folder) => {
    deleteFolder.mutate({ id: folder.id }, { onSuccess: () => handleDeleteOrMove(folder) });
  };

  const rootFolders = allFolders ? getChildFolders(allFolders, null) : [];

  return (
    <nav className="flex-1">
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <button
            ref={rootDropRef}
            type="button"
            className={`flex w-full items-center rounded px-2 py-1.5 text-left text-sm ${
              isRootDropTarget
                ? 'ring-2 ring-blue-400 bg-blue-50'
                : selectedFolder === null
                  ? 'bg-blue-100 font-semibold text-blue-800'
                  : 'text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => onSelectFolder(null)}
          >
            <span className="w-5 shrink-0" />
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

      <button
        type="button"
        className={`flex w-full items-center rounded px-2 py-1.5 text-left text-sm ${
          selectedFolder === UNCATEGORIZED_FOLDER
            ? 'bg-blue-100 font-semibold text-blue-800'
            : 'text-gray-700 hover:bg-gray-200'
        }`}
        onClick={() => onSelectFolder(UNCATEGORIZED_FOLDER)}
      >
        <span className="w-5 shrink-0" />
        未分類
      </button>

      {isLoading && (
        <div className="mt-2 space-y-2 px-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-5 animate-pulse rounded bg-gray-200" />
          ))}
        </div>
      )}

      {rootFolders.length > 0 && allFolders && (
        <SortableFolderList
          folders={rootFolders}
          allFolders={allFolders}
          selectedFolder={selectedFolder}
          onSelectFolder={onSelectFolder}
          depth={0}
          onAction={setDialogState}
          onDeleteFolder={handleDelete}
        />
      )}

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
    </nav>
  );
}

function SortableFolderList({
  folders,
  allFolders,
  selectedFolder,
  onSelectFolder,
  depth,
  onAction,
  onDeleteFolder,
}: {
  folders: Folder[];
  allFolders: Folder[];
  selectedFolder: string | null;
  onSelectFolder: (path: string | null) => void;
  depth: number;
  onAction: (state: DialogState) => void;
  onDeleteFolder: (folder: Folder) => void;
}) {
  return (
    <SortableContext items={folders.map((f) => f.id)} strategy={verticalListSortingStrategy}>
      {folders.map((folder) => (
        <SortableFolderTreeNode
          key={folder.id}
          folder={folder}
          allFolders={allFolders}
          selectedFolder={selectedFolder}
          onSelectFolder={onSelectFolder}
          depth={depth}
          onAction={onAction}
          onDeleteFolder={onDeleteFolder}
        />
      ))}
    </SortableContext>
  );
}

function SortableFolderTreeNode({
  folder,
  allFolders,
  selectedFolder,
  onSelectFolder,
  depth,
  onAction,
  onDeleteFolder,
}: {
  folder: Folder;
  allFolders: Folder[];
  selectedFolder: string | null;
  onSelectFolder: (path: string | null) => void;
  depth: number;
  onAction: (state: DialogState) => void;
  onDeleteFolder: (folder: Folder) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folder.id,
    data: { type: 'folder', folder },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isAncestorOfSelected =
    selectedFolder !== null &&
    selectedFolder !== folder.path &&
    selectedFolder.startsWith(folder.path + '/');
  const [expanded, setExpanded] = useState(isAncestorOfSelected);
  const children = getChildFolders(allFolders, folder.path);
  const isSelected = selectedFolder === folder.path;
  const hasChildren = children.length > 0;

  const { active, over } = useDndContext();
  const isDropTarget = active?.data.current?.type === 'bookmark' && over?.id === folder.id;

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'relative z-10 opacity-50' : ''}>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div
            className={`group flex items-center rounded text-sm ${
              isDropTarget
                ? 'ring-2 ring-blue-400 bg-blue-50'
                : isSelected
                  ? 'bg-blue-100 font-semibold text-blue-800'
                  : 'text-gray-700 hover:bg-gray-200'
            }`}
            style={{ paddingLeft: `${8 + depth * 12}px` }}
          >
            <button
              type="button"
              className="flex h-6 w-5 shrink-0 items-center justify-center text-gray-400"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {hasChildren ? <ChevronIcon expanded={expanded} /> : null}
            </button>

            <button
              type="button"
              className="flex-1 truncate py-1.5 text-left"
              onClick={() => {
                onSelectFolder(folder.path);
                if (!expanded) setExpanded(true);
              }}
            >
              {folder.name}
            </button>

            <button
              type="button"
              className="ml-auto flex h-6 w-4 shrink-0 cursor-grab items-center justify-center text-gray-300 opacity-0 group-hover:opacity-100 hover:text-gray-500 active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripIcon />
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
              onSelect={() => onDeleteFolder(folder)}
            >
              削除
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      {expanded && hasChildren && (
        <SortableFolderList
          folders={children}
          allFolders={allFolders}
          selectedFolder={selectedFolder}
          onSelectFolder={onSelectFolder}
          depth={depth + 1}
          onAction={onAction}
          onDeleteFolder={onDeleteFolder}
        />
      )}
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

function GripIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="5" cy="3" r="1.5" />
      <circle cx="11" cy="3" r="1.5" />
      <circle cx="5" cy="8" r="1.5" />
      <circle cx="11" cy="8" r="1.5" />
      <circle cx="5" cy="13" r="1.5" />
      <circle cx="11" cy="13" r="1.5" />
    </svg>
  );
}
