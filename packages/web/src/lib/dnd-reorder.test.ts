import { describe, expect, it } from 'vitest';

import type { Bookmark, Folder } from '../types';
import {
  applyFolderReorder,
  resolveBookmarkMoveTarget,
  resolveBookmarkReorderTarget,
} from './dnd-reorder';

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

describe('resolveBookmarkMoveTarget', () => {
  const makeActiveData = (id: string, folderPath: string | null) => ({
    type: 'bookmark',
    bookmark: { id, folderPath },
  });

  it('folder-uncategorizedへのドロップはfolderPath nullを返す', () => {
    expect(
      resolveBookmarkMoveTarget(makeActiveData('bk-1', '/work'), { type: 'folder-uncategorized' }),
    ).toEqual({ id: 'bk-1', folderPath: null });
  });

  it('folderへのドロップはそのfolderPathを返す', () => {
    expect(
      resolveBookmarkMoveTarget(makeActiveData('bk-1', null), {
        type: 'folder',
        folder: { path: '/work' },
      }),
    ).toEqual({ id: 'bk-1', folderPath: '/work' });
  });

  it('既に同じfolderPathならnullを返す（移動不要）', () => {
    expect(
      resolveBookmarkMoveTarget(makeActiveData('bk-1', null), { type: 'folder-uncategorized' }),
    ).toBeNull();
  });

  it('bookmark以外のactiveタイプはnullを返す', () => {
    expect(
      resolveBookmarkMoveTarget(
        { type: 'folder', bookmark: { id: 'f-1', folderPath: null } },
        { type: 'folder-uncategorized' },
      ),
    ).toBeNull();
  });

  it('folder/folder-uncategorized以外のoverタイプはnullを返す', () => {
    expect(
      resolveBookmarkMoveTarget(makeActiveData('bk-1', null), { type: 'bookmark' }),
    ).toBeNull();
  });
});

describe('applyFolderReorder', () => {
  const makeFolder = (id: string, parentPath: string | null, position: number): Folder => ({
    id,
    userId: 'u1',
    name: id,
    path: `/${id}`,
    parentPath,
    position,
    deletedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  });

  it('前から後ろへ移動するとき間のフォルダのpositionが1減る', () => {
    const folders = [makeFolder('a', null, 0), makeFolder('b', null, 1), makeFolder('c', null, 2)];
    const result = applyFolderReorder(folders, 'a', 2);
    expect(result.find((f) => f.id === 'a')?.position).toBe(2);
    expect(result.find((f) => f.id === 'b')?.position).toBe(0);
    expect(result.find((f) => f.id === 'c')?.position).toBe(1);
  });

  it('後ろから前へ移動するとき間のフォルダのpositionが1増える', () => {
    const folders = [makeFolder('a', null, 0), makeFolder('b', null, 1), makeFolder('c', null, 2)];
    const result = applyFolderReorder(folders, 'c', 0);
    expect(result.find((f) => f.id === 'c')?.position).toBe(0);
    expect(result.find((f) => f.id === 'a')?.position).toBe(1);
    expect(result.find((f) => f.id === 'b')?.position).toBe(2);
  });

  it('別parentPathのフォルダはpositionを変えない', () => {
    const folders = [
      makeFolder('a', null, 0),
      makeFolder('b', null, 1),
      makeFolder('child', '/a', 0),
    ];
    const result = applyFolderReorder(folders, 'a', 1);
    expect(result.find((f) => f.id === 'child')?.position).toBe(0);
  });

  it('idが見つからない場合は元の配列を返す', () => {
    const folders = [makeFolder('a', null, 0)];
    expect(applyFolderReorder(folders, 'missing', 1)).toBe(folders);
  });
});
