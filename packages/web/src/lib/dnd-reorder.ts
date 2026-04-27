import type { Bookmark } from '../types';

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
