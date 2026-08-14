import { describe, expect, it } from 'vitest';

import type { Bookmark, Folder } from '../types';
import { folderPathsDepthFirst, groupBookmarks } from './bookmark-groups';

const folder = (id: string, path: string, parentPath: string | null, position: number): Folder => ({
  id,
  userId: 'user',
  name: path.split('/').at(-1)!,
  path,
  parentPath,
  position,
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
});

const bookmark = (id: string, folderPath: string | null, position: number): Bookmark => ({
  id,
  userId: 'user',
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

const folders = [
  folder('b', '/b', null, 1),
  folder('a-child', '/a/child', '/a', 0),
  folder('a', '/a', null, 0),
  folder('empty', '/a/empty', '/a', 1),
];

describe('bookmark groups', () => {
  it('folder tree と同じ depth-first 順を組み立てる', () => {
    expect(folderPathsDepthFirst(folders, null)).toEqual(['/a', '/a/child', '/a/empty', '/b']);
  });

  it('すべて表示は未分類を先頭にし、空 group を省いて folder 内 position 順にする', () => {
    const groups = groupBookmarks(
      [
        bookmark('b-1', '/b', 0),
        bookmark('a-2', '/a', 1),
        bookmark('root', null, 0),
        bookmark('a-1', '/a', 0),
      ],
      folders,
      null,
      true,
    );

    expect(groups.map((group) => group.label)).toEqual(['未分類', '/a', '/b']);
    expect(groups[1].bookmarks.map((item) => item.id)).toEqual(['a-1', 'a-2']);
  });

  it('deep 表示は選択 folder を先頭にして子孫だけを続ける', () => {
    const groups = groupBookmarks(
      [bookmark('child', '/a/child', 0), bookmark('self', '/a', 0), bookmark('other', '/b', 0)],
      folders,
      '/a',
      false,
    );

    expect(groups.map((group) => group.label)).toEqual(['/a', '/a/child']);
  });

  it('取得済み bookmark を同じ folder の1つの group に結合する', () => {
    const fetchedPages = [
      [bookmark('a-1', '/a', 0), bookmark('a-2', '/a', 1)],
      [bookmark('a-3', '/a', 2), bookmark('child', '/a/child', 0)],
    ];

    const groups = groupBookmarks(fetchedPages.flat(), folders, '/a', false);

    expect(groups[0].bookmarks.map((item) => item.id)).toEqual(['a-1', 'a-2', 'a-3']);
    expect(groups[1].bookmarks.map((item) => item.id)).toEqual(['child']);
  });

  it('folder 一覧にない取得済み bookmark も full path の fallback group に残す', () => {
    const groups = groupBookmarks(
      [bookmark('known', '/a', 0), bookmark('stale-folder', '/missing/path', 0)],
      folders,
      null,
      true,
    );

    expect(groups.map((group) => group.label)).toEqual(['/a', '/missing/path']);
  });
});
