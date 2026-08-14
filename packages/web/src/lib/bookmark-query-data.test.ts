import type { InfiniteData } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import type { Bookmark } from '../types';
import {
  moveBookmarkInQueryData,
  removeBookmarkFromQueryData,
  type BookmarkQueryData,
} from './bookmark-query-data';

const bookmark = (id: string, folderPath: string | null, position: number): Bookmark => ({
  id,
  userId: 'test-user',
  url: `https://example.com/${id}`,
  title: id,
  description: null,
  imageUrl: null,
  faviconUrl: null,
  folderPath,
  position,
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
});

const infinite = (...pages: Bookmark[][]): BookmarkQueryData =>
  ({
    pages: pages.map((data, index) => ({
      data,
      nextCursor: index < pages.length - 1 ? `page-${index + 2}` : null,
    })),
    pageParams: pages.map((_, index) => (index === 0 ? '' : `page-${index + 1}`)),
  }) satisfies InfiniteData<{ data: Bookmark[]; nextCursor: string | null }>;

describe('bookmark query data', () => {
  it('paginated cacheから対象bookmarkだけを削除してpage情報を維持する', () => {
    const before = infinite(
      [bookmark('a', null, 0), bookmark('b', null, 1)],
      [bookmark('c', '/work', 0)],
    );

    const after = removeBookmarkFromQueryData(before, 'b');

    expect(after).toMatchObject({ pageParams: ['', 'page-2'] });
    expect(Array.isArray(after) ? [] : after?.pages.map((page) => page.nextCursor)).toEqual([
      'page-2',
      null,
    ]);
    expect(
      Array.isArray(after) ? [] : after?.pages.map((page) => page.data.map((item) => item.id)),
    ).toEqual([['a'], ['c']]);
  });

  it('paginated all cacheではbookmarkを移動先groupへ即時移動する', () => {
    const moved = bookmark('a', '/source', 0);
    const before = infinite(
      [moved, bookmark('source-next', '/source', 1)],
      [bookmark('target', '/target', 0)],
    );

    const after = moveBookmarkInQueryData(
      before,
      ['bookmarks', 'paginated', { folder: null, deep: true }],
      moved,
      '/target',
    );
    const items = Array.isArray(after) ? after : after?.pages.flatMap((page) => page.data);

    expect(items?.map((item) => `${item.id}:${item.folderPath}:${item.position}`)).toEqual([
      'a:/target:0',
      'source-next:/source:0',
      'target:/target:1',
    ]);
  });

  it('移動先のpaginated cacheにはbookmarkを追加し、移動元からは削除する', () => {
    const moved = bookmark('a', '/source', 0);
    const source = moveBookmarkInQueryData(
      infinite([moved, bookmark('source-next', '/source', 1)]),
      ['bookmarks', 'paginated', { folder: '/source', deep: false }],
      moved,
      '/target',
    );
    const target = moveBookmarkInQueryData(
      infinite([bookmark('target', '/target', 0)]),
      ['bookmarks', 'paginated', { folder: '/target', deep: false }],
      moved,
      '/target',
    );

    expect(Array.isArray(source) ? [] : source?.pages[0].data.map((item) => item.id)).toEqual([
      'source-next',
    ]);
    expect(Array.isArray(target) ? [] : target?.pages[0].data.map((item) => item.id)).toEqual([
      'a',
      'target',
    ]);
  });
});
