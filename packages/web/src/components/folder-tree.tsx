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
import * as ContextMenu from '@radix-ui/react-context-menu';
import { useState } from 'react';

import { useDeleteFolder } from '../hooks/use-delete-folder';
import { useFolders } from '../hooks/use-folders';
import { useReorderFolder } from '../hooks/use-reorder-folder';
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
  const { data: folders, isLoading } = useFolders(null);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const reorderFolder = useReorderFolder();
  const deleteFolder = useDeleteFolder();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (reorderFolder.isPending) return;

    const { active, over } = event;
    if (!over || active.id === over.id || !folders) return;

    const oldIndex = folders.findIndex((f) => f.id === active.id);
    const newIndex = folders.findIndex((f) => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    reorderFolder.mutate({
      id: folders[oldIndex].id,
      position: folders[newIndex].position,
    });
  };

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

      {folders && folders.length > 0 && (
        <SortableFolderList
          folders={folders}
          selectedFolder={selectedFolder}
          onSelectFolder={onSelectFolder}
          depth={0}
          onAction={setDialogState}
          onDeleteFolder={handleDelete}
          sensors={sensors}
          onDragEnd={handleDragEnd}
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
  selectedFolder,
  onSelectFolder,
  depth,
  onAction,
  onDeleteFolder,
  sensors,
  onDragEnd,
}: {
  folders: Folder[];
  selectedFolder: string | null;
  onSelectFolder: (path: string | null) => void;
  depth: number;
  onAction: (state: DialogState) => void;
  onDeleteFolder: (folder: Folder) => void;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (event: DragEndEvent) => void;
}) {
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={folders.map((f) => f.id)} strategy={verticalListSortingStrategy}>
        {folders.map((folder) => (
          <SortableFolderTreeNode
            key={folder.id}
            folder={folder}
            selectedFolder={selectedFolder}
            onSelectFolder={onSelectFolder}
            depth={depth}
            onAction={onAction}
            onDeleteFolder={onDeleteFolder}
            sensors={sensors}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableFolderTreeNode({
  folder,
  selectedFolder,
  onSelectFolder,
  depth,
  onAction,
  onDeleteFolder,
  sensors,
}: {
  folder: Folder;
  selectedFolder: string | null;
  onSelectFolder: (path: string | null) => void;
  depth: number;
  onAction: (state: DialogState) => void;
  onDeleteFolder: (folder: Folder) => void;
  sensors: ReturnType<typeof useSensors>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folder.id,
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
  const { data: children, isLoading } = useFolders(folder.path, expanded || isAncestorOfSelected);
  const isSelected = selectedFolder === folder.path;
  const hasChildren = children && children.length > 0;

  const reorderFolder = useReorderFolder();

  const handleChildDragEnd = (event: DragEndEvent) => {
    if (reorderFolder.isPending) return;

    const { active, over } = event;
    if (!over || active.id === over.id || !children) return;

    const oldIndex = children.findIndex((f) => f.id === active.id);
    const newIndex = children.findIndex((f) => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    reorderFolder.mutate({
      id: children[oldIndex].id,
      position: children[newIndex].position,
    });
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'relative z-10 opacity-50' : ''}>
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
              className="flex h-6 w-4 shrink-0 cursor-grab items-center justify-center text-gray-300 hover:text-gray-500 active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripIcon />
            </button>

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
              onClick={() => {
                onSelectFolder(folder.path);
                if (!expanded) setExpanded(true);
              }}
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
              onSelect={() => onDeleteFolder(folder)}
            >
              削除
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      {expanded && children && children.length > 0 && (
        <SortableFolderList
          folders={children}
          selectedFolder={selectedFolder}
          onSelectFolder={onSelectFolder}
          depth={depth + 1}
          onAction={onAction}
          onDeleteFolder={onDeleteFolder}
          sensors={sensors}
          onDragEnd={handleChildDragEnd}
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
