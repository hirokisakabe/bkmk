import type { InfiniteData, QueryKey } from '@tanstack/react-query';

import type { Bookmark } from '../types';

interface BookmarkPage {
  data: Bookmark[];
  nextCursor: string | null;
}

export type BookmarkQueryData = Bookmark[] | InfiniteData<BookmarkPage>;

export function bookmarksFromQueryData(data: BookmarkQueryData | undefined): Bookmark[] {
  if (!data) return [];
  return Array.isArray(data) ? data : data.pages.flatMap((page) => page.data);
}

export function removeBookmarkFromQueryData(
  data: BookmarkQueryData | undefined,
  id: string,
): BookmarkQueryData | undefined {
  if (!data) return data;
  if (Array.isArray(data)) return data.filter((bookmark) => bookmark.id !== id);

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      data: page.data.filter((bookmark) => bookmark.id !== id),
    })),
  };
}

function queryIncludesFolder(queryKey: QueryKey, folderPath: string | null): boolean {
  const params = queryKey.at(-1);
  if (!params || typeof params !== 'object' || !('folder' in params)) return false;

  const folder = params.folder;
  const deep = 'deep' in params && params.deep === true;
  if (folder === null) return deep || folderPath === null;
  if (typeof folder !== 'string') return false;
  return folderPath === folder || (deep && folderPath?.startsWith(`${folder}/`) === true);
}

function moveBookmarks(
  bookmarks: Bookmark[],
  movedBookmark: Bookmark,
  folderPath: string | null,
  includeMovedBookmark: boolean,
): Bookmark[] {
  return bookmarks.flatMap((bookmark) => {
    if (bookmark.id === movedBookmark.id) {
      return includeMovedBookmark ? [{ ...bookmark, folderPath, position: 0 }] : [];
    }
    if (
      bookmark.folderPath === movedBookmark.folderPath &&
      bookmark.position > movedBookmark.position
    ) {
      return [{ ...bookmark, position: bookmark.position - 1 }];
    }
    if (bookmark.folderPath === folderPath) {
      return [{ ...bookmark, position: bookmark.position + 1 }];
    }
    return [bookmark];
  });
}

export function moveBookmarkInQueryData(
  data: BookmarkQueryData | undefined,
  queryKey: QueryKey,
  movedBookmark: Bookmark,
  folderPath: string | null,
): BookmarkQueryData | undefined {
  if (!data) return data;

  const includesTarget = queryIncludesFolder(queryKey, folderPath);

  if (Array.isArray(data)) {
    const moved = moveBookmarks(data, movedBookmark, folderPath, false);
    if (includesTarget) {
      return [{ ...movedBookmark, folderPath, position: 0 }, ...moved];
    }
    return moved;
  }

  const pages = data.pages.map((page) => ({
    ...page,
    data: moveBookmarks(page.data, movedBookmark, folderPath, false),
  }));
  if (includesTarget && pages[0]) {
    pages[0] = {
      ...pages[0],
      data: [{ ...movedBookmark, folderPath, position: 0 }, ...pages[0].data],
    };
  }

  return { ...data, pages };
}
