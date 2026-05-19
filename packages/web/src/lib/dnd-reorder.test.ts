import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Bookmark, Folder } from '../types';
import {
  applyBookmarkReorder,
  applyFolderReorder,
  resolveBookmarkMoveTarget,
  resolveBookmarkReorderTarget,
  resolveCanReorderBookmarks,
  resolveCanSortBookmarkList,
} from './dnd-reorder';

const makeBookmark = (
  id: string,
  position: number,
  folderPath: string | null = null,
): Bookmark => ({
  id,
  userId: 'u1',
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

describe('resolveCanReorderBookmarks', () => {
  it('isAllBookmarks=true のとき常に false', () => {
    expect(
      resolveCanReorderBookmarks({ isAllBookmarks: true, deep: false, hasSubfolders: false }),
    ).toBe(false);
    expect(
      resolveCanReorderBookmarks({ isAllBookmarks: true, deep: false, hasSubfolders: true }),
    ).toBe(false);
    expect(
      resolveCanReorderBookmarks({ isAllBookmarks: true, deep: true, hasSubfolders: false }),
    ).toBe(false);
    expect(
      resolveCanReorderBookmarks({ isAllBookmarks: true, deep: true, hasSubfolders: true }),
    ).toBe(false);
  });

  it('isAllBookmarks=false かつ deep=false のとき true', () => {
    expect(
      resolveCanReorderBookmarks({ isAllBookmarks: false, deep: false, hasSubfolders: false }),
    ).toBe(true);
    expect(
      resolveCanReorderBookmarks({ isAllBookmarks: false, deep: false, hasSubfolders: true }),
    ).toBe(true);
  });

  it('isAllBookmarks=false かつ deep=true かつ hasSubfolders=true のとき false（サブフォルダあり）', () => {
    expect(
      resolveCanReorderBookmarks({ isAllBookmarks: false, deep: true, hasSubfolders: true }),
    ).toBe(false);
  });

  it('isAllBookmarks=false かつ deep=true かつ hasSubfolders=false のとき true（末端フォルダ）', () => {
    expect(
      resolveCanReorderBookmarks({ isAllBookmarks: false, deep: true, hasSubfolders: false }),
    ).toBe(true);
  });
});

describe('resolveCanSortBookmarkList', () => {
  it('undefined のとき false', () => {
    expect(resolveCanSortBookmarkList(undefined)).toBe(false);
  });

  it('空配列のとき false', () => {
    expect(resolveCanSortBookmarkList([])).toBe(false);
  });

  it('1件のとき false', () => {
    expect(resolveCanSortBookmarkList([makeBookmark('a', 0)])).toBe(false);
  });

  it('2件のとき true', () => {
    expect(resolveCanSortBookmarkList([makeBookmark('a', 0), makeBookmark('b', 1)])).toBe(true);
  });

  it('3件以上のとき true', () => {
    expect(
      resolveCanSortBookmarkList([
        makeBookmark('a', 0),
        makeBookmark('b', 1),
        makeBookmark('c', 2),
      ]),
    ).toBe(true);
  });
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

  it('activeとoverのfolderPathが異なる場合はnullを返す', () => {
    const mixedFolderBookmarks = [makeBookmark('a', 0, '/work'), makeBookmark('b', 0, '/personal')];

    expect(resolveBookmarkReorderTarget(mixedFolderBookmarks, 'a', 'b')).toBeNull();
  });
});

describe('applyBookmarkReorder', () => {
  const rootBookmarks = [
    makeBookmark('a', 0),
    makeBookmark('b', 1),
    makeBookmark('c', 2),
    makeBookmark('d', 3),
  ];

  const positionsInFolder = (bookmarks: Bookmark[], folderPath: string | null) =>
    bookmarks.filter((b) => b.folderPath === folderPath).map((b) => b.position);

  it('前から後ろへ移動すると同一フォルダ内のpositionが一意に保たれる', () => {
    const result = applyBookmarkReorder(rootBookmarks, 'a', 2);

    expect(result.map((b) => `${b.id}:${b.position}`)).toEqual(['b:0', 'c:1', 'a:2', 'd:3']);
    expect(new Set(positionsInFolder(result, null)).size).toBe(rootBookmarks.length);
  });

  it('後ろから前へ移動すると同一フォルダ内のpositionが一意に保たれる', () => {
    const result = applyBookmarkReorder(rootBookmarks, 'd', 1);

    expect(result.map((b) => `${b.id}:${b.position}`)).toEqual(['a:0', 'd:1', 'b:2', 'c:3']);
    expect(new Set(positionsInFolder(result, null)).size).toBe(rootBookmarks.length);
  });

  it('同じfolderPathのブックマークだけをシフトし、別フォルダは変えない', () => {
    const bookmarks = [
      makeBookmark('a', 0, '/work'),
      makeBookmark('other-a', 0, '/personal'),
      makeBookmark('b', 1, '/work'),
      makeBookmark('other-b', 1, '/personal'),
    ];

    const result = applyBookmarkReorder(bookmarks, 'a', 1);

    expect(result.map((b) => b.id)).toEqual(['b', 'other-a', 'a', 'other-b']);
    expect(result.find((b) => b.id === 'a')?.position).toBe(1);
    expect(result.find((b) => b.id === 'b')?.position).toBe(0);
    expect(result.find((b) => b.id === 'other-a')?.position).toBe(0);
    expect(result.find((b) => b.id === 'other-b')?.position).toBe(1);
    expect(new Set(positionsInFolder(result, '/work')).size).toBe(2);
    expect(new Set(positionsInFolder(result, '/personal')).size).toBe(2);
  });

  it('同じpositionへの移動はno-opとして元の配列を返す', () => {
    expect(applyBookmarkReorder(rootBookmarks, 'b', 1)).toBe(rootBookmarks);
  });

  it('idが見つからない場合はno-opとして元の配列を返す', () => {
    expect(applyBookmarkReorder(rootBookmarks, 'missing', 1)).toBe(rootBookmarks);
  });

  it('並べ替え後も同一folderPath内のpositionは{0,...,n-1}を保つ', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }).chain((n) =>
          fc.record({
            n: fc.constant(n),
            activeIdx: fc.integer({ min: 0, max: n - 1 }),
            newPos: fc.integer({ min: 0, max: n - 1 }),
          }),
        ),
        ({ n, activeIdx, newPos }) => {
          const bookmarks = Array.from({ length: n }, (_, i) =>
            makeBookmark(`bk-${i}`, i, '/work'),
          );
          const result = applyBookmarkReorder(bookmarks, bookmarks[activeIdx].id, newPos);
          const positions = result
            .filter((b) => b.folderPath === '/work')
            .map((b) => b.position)
            .sort((a, b) => a - b);
          expect(positions).toEqual(Array.from({ length: n }, (_, i) => i));
        },
      ),
    );
  });

  it('別folderPathのpositionは変化しない', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }).chain((n) =>
          fc.integer({ min: 2, max: 5 }).chain((m) =>
            fc.record({
              n: fc.constant(n),
              m: fc.constant(m),
              activeIdx: fc.integer({ min: 0, max: n - 1 }),
              newPos: fc.integer({ min: 0, max: n - 1 }),
            }),
          ),
        ),
        ({ n, m, activeIdx, newPos }) => {
          const workBookmarks = Array.from({ length: n }, (_, i) =>
            makeBookmark(`work-${i}`, i, '/work'),
          );
          const personalBookmarks = Array.from({ length: m }, (_, i) =>
            makeBookmark(`personal-${i}`, i, '/personal'),
          );
          const result = applyBookmarkReorder(
            [...workBookmarks, ...personalBookmarks],
            workBookmarks[activeIdx].id,
            newPos,
          );
          for (const orig of personalBookmarks) {
            const updated = result.find((b) => b.id === orig.id);
            expect(updated?.position).toBe(orig.position);
          }
        },
      ),
    );
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

  it('通常folderでも既に同じfolderPathならnullを返す（移動不要）', () => {
    expect(
      resolveBookmarkMoveTarget(makeActiveData('bk-1', '/work'), {
        type: 'folder',
        folder: { path: '/work' },
      }),
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

  it('bookmark上へのドロップはfolder移動として扱わない', () => {
    expect(
      resolveBookmarkMoveTarget(makeActiveData('bk-1', '/work'), { type: 'bookmark' }),
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
    expect(new Set(result.filter((f) => f.parentPath === null).map((f) => f.position)).size).toBe(
      3,
    );
  });

  it('後ろから前へ移動するとき間のフォルダのpositionが1増える', () => {
    const folders = [makeFolder('a', null, 0), makeFolder('b', null, 1), makeFolder('c', null, 2)];
    const result = applyFolderReorder(folders, 'c', 0);
    expect(result.find((f) => f.id === 'c')?.position).toBe(0);
    expect(result.find((f) => f.id === 'a')?.position).toBe(1);
    expect(result.find((f) => f.id === 'b')?.position).toBe(2);
    expect(new Set(result.filter((f) => f.parentPath === null).map((f) => f.position)).size).toBe(
      3,
    );
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

  it('同じpositionへの移動はno-opとして元の配列を返す', () => {
    const folders = [makeFolder('a', null, 0), makeFolder('b', null, 1)];
    expect(applyFolderReorder(folders, 'a', 0)).toBe(folders);
  });

  it('idが見つからない場合は元の配列を返す', () => {
    const folders = [makeFolder('a', null, 0)];
    expect(applyFolderReorder(folders, 'missing', 1)).toBe(folders);
  });

  it('並べ替え後も同一parentPath内のpositionは{0,...,n-1}を保つ', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }).chain((n) =>
          fc.record({
            n: fc.constant(n),
            activeIdx: fc.integer({ min: 0, max: n - 1 }),
            newPos: fc.integer({ min: 0, max: n - 1 }),
          }),
        ),
        ({ n, activeIdx, newPos }) => {
          const folders = Array.from({ length: n }, (_, i) => makeFolder(`f${i}`, null, i));
          const result = applyFolderReorder(folders, folders[activeIdx].id, newPos);
          const positions = result
            .filter((f) => f.parentPath === null)
            .map((f) => f.position)
            .sort((a, b) => a - b);
          expect(positions).toEqual(Array.from({ length: n }, (_, i) => i));
        },
      ),
    );
  });

  it('別parentPathのpositionは変化しない', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }).chain((n) =>
          fc.integer({ min: 2, max: 5 }).chain((m) =>
            fc.record({
              n: fc.constant(n),
              m: fc.constant(m),
              activeIdx: fc.integer({ min: 0, max: n - 1 }),
              newPos: fc.integer({ min: 0, max: n - 1 }),
            }),
          ),
        ),
        ({ n, m, activeIdx, newPos }) => {
          const rootFolders = Array.from({ length: n }, (_, i) => makeFolder(`root${i}`, null, i));
          const childFolders = Array.from({ length: m }, (_, i) =>
            makeFolder(`child${i}`, '/parent', i),
          );
          const result = applyFolderReorder(
            [...rootFolders, ...childFolders],
            rootFolders[activeIdx].id,
            newPos,
          );
          for (const orig of childFolders) {
            const updated = result.find((f) => f.id === orig.id);
            expect(updated?.position).toBe(orig.position);
          }
        },
      ),
    );
  });
});
