import type { Bookmark, Folder } from '../types';

interface BookmarkGroup {
  folderPath: string | null;
  label: string;
  bookmarks: Bookmark[];
}

export function folderPathsDepthFirst(folders: Folder[], parentPath: string | null): string[] {
  const childrenByParent = new Map<string | null, Folder[]>();
  for (const folder of folders) {
    const children = childrenByParent.get(folder.parentPath) ?? [];
    children.push(folder);
    childrenByParent.set(folder.parentPath, children);
  }
  for (const children of childrenByParent.values()) {
    children.sort((a, b) => a.position - b.position || a.path.localeCompare(b.path));
  }

  const result: string[] = [];
  const visited = new Set<string>();
  const stack = [...(childrenByParent.get(parentPath) ?? [])].reverse();
  while (stack.length > 0) {
    const folder = stack.pop()!;
    if (visited.has(folder.path)) continue;
    visited.add(folder.path);
    result.push(folder.path);
    const children = childrenByParent.get(folder.path) ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]);
    }
  }
  return result;
}

export function groupBookmarks(
  bookmarks: Bookmark[],
  folders: Folder[],
  rootFolderPath: string | null,
  isAllBookmarks: boolean,
): BookmarkGroup[] {
  const orderedPaths = isAllBookmarks
    ? [null, ...folderPathsDepthFirst(folders, null)]
    : [rootFolderPath, ...folderPathsDepthFirst(folders, rootFolderPath)];
  const bookmarksByFolder = new Map<string | null, Bookmark[]>();

  for (const bookmark of bookmarks) {
    const group = bookmarksByFolder.get(bookmark.folderPath) ?? [];
    group.push(bookmark);
    bookmarksByFolder.set(bookmark.folderPath, group);
  }

  const groups: BookmarkGroup[] = [];
  for (const folderPath of orderedPaths) {
    const groupBookmarks = bookmarksByFolder.get(folderPath);
    if (groupBookmarks?.length) {
      groups.push({
        folderPath,
        label: folderPath ?? '未分類',
        bookmarks: groupBookmarks.toSorted(
          (a, b) => a.position - b.position || a.id.localeCompare(b.id),
        ),
      });
      bookmarksByFolder.delete(folderPath);
    }
  }

  const remainingPaths = [...bookmarksByFolder.keys()]
    .filter(
      (path) =>
        isAllBookmarks ||
        path === rootFolderPath ||
        (rootFolderPath !== null && path?.startsWith(`${rootFolderPath}/`) === true),
    )
    .toSorted((a, b) => (a ?? '').localeCompare(b ?? ''));
  for (const folderPath of remainingPaths) {
    const groupBookmarks = bookmarksByFolder.get(folderPath)!;
    groups.push({
      folderPath,
      label: folderPath ?? '未分類',
      bookmarks: groupBookmarks.toSorted(
        (a, b) => a.position - b.position || a.id.localeCompare(b.id),
      ),
    });
  }

  return groups;
}
