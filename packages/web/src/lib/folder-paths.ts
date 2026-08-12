import type { InfiniteData, QueryKey } from '@tanstack/react-query';

import type { Bookmark, Folder } from '../types';

interface BookmarkPage {
  data: Bookmark[];
  nextCursor: string | null;
}

export type BookmarkQueryData = Bookmark[] | InfiniteData<BookmarkPage>;

export function rebaseFolderPath(
  path: string | null,
  oldPath: string,
  newPath: string,
): string | null {
  if (path === oldPath) return newPath;
  if (path?.startsWith(`${oldPath}/`)) return `${newPath}${path.slice(oldPath.length)}`;
  return path;
}

export function rebaseFolders(
  folders: Folder[],
  {
    folderId,
    oldPath,
    newPath,
    newParentPath,
    newName,
    moved,
  }: {
    folderId: string;
    oldPath: string;
    newPath: string;
    newParentPath: string | null;
    newName: string;
    moved: boolean;
  },
): Folder[] {
  return folders.map((folder) => {
    if (folder.id === folderId) {
      return {
        ...folder,
        name: newName,
        path: newPath,
        parentPath: newParentPath,
        position: moved ? 0 : folder.position,
      };
    }

    const isDestinationSibling = moved && folder.parentPath === newParentPath;
    const path = rebaseFolderPath(folder.path, oldPath, newPath);
    const parentPath = rebaseFolderPath(folder.parentPath, oldPath, newPath);

    if (path === folder.path && parentPath === folder.parentPath && !isDestinationSibling) {
      return folder;
    }

    return {
      ...folder,
      path: path ?? folder.path,
      parentPath,
      position: isDestinationSibling ? folder.position + 1 : folder.position,
    };
  });
}

function rebaseBookmarks(bookmarks: Bookmark[], oldPath: string, newPath: string): Bookmark[] {
  return bookmarks.map((bookmark) => {
    const folderPath = rebaseFolderPath(bookmark.folderPath, oldPath, newPath);
    return folderPath === bookmark.folderPath ? bookmark : { ...bookmark, folderPath };
  });
}

export function rebaseBookmarkQueryData(
  data: BookmarkQueryData | undefined,
  oldPath: string,
  newPath: string,
): BookmarkQueryData | undefined {
  if (!data) return data;
  if (Array.isArray(data)) return rebaseBookmarks(data, oldPath, newPath);

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      data: rebaseBookmarks(page.data, oldPath, newPath),
    })),
  };
}

export function rebaseBookmarkQueryKey(
  queryKey: QueryKey,
  oldPath: string,
  newPath: string,
): QueryKey {
  const lastPart = queryKey.at(-1);
  if (!lastPart || typeof lastPart !== 'object' || !('folder' in lastPart)) return queryKey;

  const folder = lastPart.folder;
  if (typeof folder !== 'string') return queryKey;

  const rebasedFolder = rebaseFolderPath(folder, oldPath, newPath);
  if (rebasedFolder === folder) return queryKey;

  return [...queryKey.slice(0, -1), { ...lastPart, folder: rebasedFolder }];
}
