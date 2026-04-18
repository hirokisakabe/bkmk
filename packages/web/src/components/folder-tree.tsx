import { useState } from 'react';

import { useFolders } from '../hooks/use-folders';
import type { Folder } from '../types';

export function FolderTree({
  selectedFolder,
  onSelectFolder,
}: {
  selectedFolder: string | null;
  onSelectFolder: (path: string | null) => void;
}) {
  const { data: folders, isLoading } = useFolders(null);

  return (
    <nav className="flex-1">
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

      {isLoading && (
        <div className="mt-2 space-y-2 px-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-5 animate-pulse rounded bg-gray-200"
            />
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
        />
      ))}
    </nav>
  );
}

function FolderTreeNode({
  folder,
  selectedFolder,
  onSelectFolder,
  depth,
}: {
  folder: Folder;
  selectedFolder: string | null;
  onSelectFolder: (path: string | null) => void;
  depth: number;
}) {
  const isAncestorOfSelected =
    selectedFolder !== null &&
    selectedFolder !== folder.path &&
    selectedFolder.startsWith(folder.path + '/');
  const [expanded, setExpanded] = useState(isAncestorOfSelected);
  const { data: children, isLoading } = useFolders(
    folder.path,
    expanded || isAncestorOfSelected,
  );
  const isSelected = selectedFolder === folder.path;
  const hasChildren = children && children.length > 0;

  return (
    <div>
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

      {expanded &&
        children?.map((child) => (
          <FolderTreeNode
            key={child.id}
            folder={child}
            selectedFolder={selectedFolder}
            onSelectFolder={onSelectFolder}
            depth={depth + 1}
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
    <svg
      className="h-3 w-3 animate-spin text-gray-400"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
