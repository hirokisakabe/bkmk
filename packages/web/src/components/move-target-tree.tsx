import { useMemo, useState } from 'react';

import { getChildFolders, useAllFolders } from '../hooks/use-folders';
import type { Folder } from '../types';

const rowStateClasses = {
  selected: 'bg-blue-100 font-semibold text-blue-800 hover:bg-blue-200',
  default: 'text-gray-700 hover:bg-gray-100',
};

export function MoveTargetRow({
  label,
  path,
  depth = 0,
  selected,
  hasChildren = false,
  expanded = false,
  showExpandControl = false,
  onToggle,
  onSelect,
}: {
  label: string;
  path: string | null;
  depth?: number;
  selected: boolean;
  hasChildren?: boolean;
  expanded?: boolean;
  showExpandControl?: boolean;
  onToggle?: () => void;
  onSelect: (path: string | null) => void;
}) {
  return (
    <div
      data-testid={`move-target-row-${path ?? 'top'}`}
      data-selected={selected || undefined}
      className={`group flex min-h-10 w-full items-center ${
        selected ? rowStateClasses.selected : rowStateClasses.default
      }`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      {hasChildren && showExpandControl ? (
        <button
          type="button"
          aria-label={`${label}を${expanded ? '折りたたむ' : '展開する'}`}
          aria-expanded={expanded}
          onClick={(event) => {
            event.stopPropagation();
            onToggle?.();
          }}
          className="flex h-10 w-6 shrink-0 items-center justify-center rounded-sm text-gray-500 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
        >
          <ChevronIcon expanded={expanded} />
        </button>
      ) : (
        <span aria-hidden="true" className="h-10 w-6 shrink-0" />
      )}
      <button
        type="button"
        onClick={() => onSelect(path)}
        className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-sm pr-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
      >
        <FolderIcon />
        <span className="truncate">{label}</span>
      </button>
    </div>
  );
}

export function MoveTargetTree({
  excludePath,
  selectedPath,
  onSelect,
  searchQuery,
}: {
  excludePath?: string;
  selectedPath: string | null;
  onSelect: (path: string | null) => void;
  searchQuery: string;
}) {
  const { data: allFolders } = useAllFolders();
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());

  const folders = useMemo(() => {
    if (!allFolders) return [];
    if (!excludePath) return allFolders;
    return allFolders.filter(
      (folder) => folder.path !== excludePath && !folder.path.startsWith(`${excludePath}/`),
    );
  }, [allFolders, excludePath]);

  const pathsWithChildren = useMemo(() => {
    const paths = new Set<string | null>();
    for (const folder of folders) paths.add(folder.parentPath);
    return paths;
  }, [folders]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;
  const visiblePaths = useMemo(() => {
    if (!isSearching) return null;

    const visible = new Set<string>();
    for (const folder of folders) {
      if (!folder.name.toLowerCase().includes(normalizedQuery)) continue;
      visible.add(folder.path);
      for (const ancestor of getAncestorPaths(folder.path)) visible.add(ancestor);
    }
    return visible;
  }, [folders, isSearching, normalizedQuery]);

  if (!allFolders) return null;

  const toggleExpand = (path: string) => {
    setExpandedPaths((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderTree = (parentPath: string | null, depth: number): React.ReactNode[] =>
    getChildFolders(folders, parentPath).flatMap((folder: Folder) => {
      if (visiblePaths && !visiblePaths.has(folder.path)) return [];

      const expanded = isSearching || expandedPaths.has(folder.path);
      const hasChildren = pathsWithChildren.has(folder.path);
      const node = (
        <MoveTargetRow
          key={folder.id}
          label={folder.name}
          path={folder.path}
          depth={depth}
          selected={selectedPath === folder.path}
          hasChildren={hasChildren}
          expanded={expanded}
          showExpandControl={!isSearching}
          onToggle={() => toggleExpand(folder.path)}
          onSelect={onSelect}
        />
      );

      return expanded ? [node, ...renderTree(folder.path, depth + 1)] : [node];
    });

  return <>{renderTree(null, 0)}</>;
}

function getAncestorPaths(path: string): string[] {
  const parts = path.split('/').filter(Boolean);
  return parts.slice(0, -1).map((_, index) => `/${parts.slice(0, index + 1).join('/')}`);
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
      viewBox="0 0 12 12"
      fill="currentColor"
    >
      <path d="M4.5 2l4 4-4 4V2z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M1.75 4.25h4l1.5 1.5h7v6.5a1.5 1.5 0 0 1-1.5 1.5h-9.5a1.5 1.5 0 0 1-1.5-1.5v-8Z" />
      <path d="M1.75 5.75v-2a1.5 1.5 0 0 1 1.5-1.5H5l1.5 1.5h6.25a1.5 1.5 0 0 1 1.5 1.5v.5" />
    </svg>
  );
}
