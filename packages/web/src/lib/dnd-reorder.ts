import type { Bookmark, Folder } from '../types';

export function resolveBookmarkReorderTarget(
  bookmarks: Bookmark[] | undefined,
  activeId: string,
  overId: string,
): { id: string; position: number } | null {
  if (!bookmarks) return null;

  const oldIndex = bookmarks.findIndex((b) => b.id === activeId);
  const newIndex = bookmarks.findIndex((b) => b.id === overId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return null;

  return { id: activeId, position: bookmarks[newIndex].position };
}

export function resolveBookmarkMoveTarget(
  activeData: { type: string; bookmark: Pick<Bookmark, 'id' | 'folderPath'> },
  overData: { type: string; folder?: Pick<Folder, 'path'> },
): { id: string; folderPath: string | null } | null {
  if (activeData.type !== 'bookmark') return null;
  if (overData.type !== 'folder' && overData.type !== 'folder-uncategorized') return null;

  const targetPath: string | null =
    overData.type === 'folder-uncategorized' ? null : (overData.folder?.path ?? null);

  if (activeData.bookmark.folderPath === targetPath) return null;

  return { id: activeData.bookmark.id, folderPath: targetPath };
}

export function applyFolderReorder(folders: Folder[], id: string, position: number): Folder[] {
  const item = folders.find((f) => f.id === id);
  if (!item) return folders;

  const oldPosition = item.position;
  return folders
    .map((f) => {
      if (f.id === id) return { ...f, position };
      if (f.parentPath !== item.parentPath) return f;
      if (oldPosition < position) {
        if (f.position > oldPosition && f.position <= position) {
          return { ...f, position: f.position - 1 };
        }
      } else {
        if (f.position >= position && f.position < oldPosition) {
          return { ...f, position: f.position + 1 };
        }
      }
      return f;
    })
    .sort((a, b) => a.position - b.position);
}
