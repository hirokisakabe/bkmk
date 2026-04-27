import { describe, expect, it } from 'vitest';

import type { Bookmark } from '../types';
import { resolveBookmarkReorderTarget } from './dnd-reorder';

const makeBookmark = (id: string, position: number): Bookmark => ({
  id,
  userId: 'u1',
  url: `https://example.com/${id}`,
  title: id,
  description: null,
  imageUrl: null,
  faviconUrl: null,
  folderPath: null,
  position,
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
});

describe('resolveBookmarkReorderTarget', () => {
  const bookmarks = [
    makeBookmark('a', 0),
    makeBookmark('b', 1),
    makeBookmark('c', 2),
    makeBookmark('d', 3),
  ];

  it('overのインデックスに対応するpositionを返す', () => {
    expect(resolveBookmarkReorderTarget(bookmarks, 'a', 'c')).toEqual({
      id: 'a',
      position: 2,
    });
  });

  it('逆方向の移動でもoverのpositionを返す', () => {
    expect(resolveBookmarkReorderTarget(bookmarks, 'd', 'b')).toEqual({
      id: 'd',
      position: 1,
    });
  });

  it('overData.bookmarkスナップショットではなく渡された配列の値を使う', () => {
    // キャッシュ側で楽観的更新が反映され、c の position が 5 にズレているケース
    const reordered = [
      makeBookmark('a', 0),
      makeBookmark('b', 1),
      makeBookmark('c', 5),
      makeBookmark('d', 6),
    ];
    expect(resolveBookmarkReorderTarget(reordered, 'a', 'c')).toEqual({
      id: 'a',
      position: 5,
    });
  });

  it('bookmarksがundefinedの場合はnullを返す', () => {
    expect(resolveBookmarkReorderTarget(undefined, 'a', 'b')).toBeNull();
  });

  it('activeIdが見つからない場合はnullを返す', () => {
    expect(resolveBookmarkReorderTarget(bookmarks, 'missing', 'b')).toBeNull();
  });

  it('overIdが見つからない場合はnullを返す', () => {
    expect(resolveBookmarkReorderTarget(bookmarks, 'a', 'missing')).toBeNull();
  });

  it('同じインデックスの場合はnullを返す', () => {
    expect(resolveBookmarkReorderTarget(bookmarks, 'b', 'b')).toBeNull();
  });
});
