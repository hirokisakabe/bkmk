import { beforeEach, describe, expect, it, vi } from 'vitest';

const dndKit = vi.hoisted(() => ({
  closestCenter: vi.fn(),
  pointerWithin: vi.fn(),
}));

vi.mock('@dnd-kit/core', () => dndKit);

import { collisionDetection } from './dnd-collision';

const makeContainer = (id: string, type: string) =>
  ({ id, data: { current: { type } } }) as unknown as Parameters<
    typeof collisionDetection
  >[0]['droppableContainers'][number];

const createArgs = (type: string, droppableContainers: ReturnType<typeof makeContainer>[] = []) =>
  ({
    active: {
      data: {
        current: { type },
      },
    },
    droppableContainers,
  }) as unknown as Parameters<typeof collisionDetection>[0];

describe('collisionDetection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bookmarkドラッグ時はpointerWithinに結果があればそれを返す', () => {
    const pointerCollisions: ReturnType<typeof collisionDetection> = [{ id: 'bookmark-1' }];
    const centerCollisions: ReturnType<typeof collisionDetection> = [{ id: 'folder-1' }];
    dndKit.pointerWithin.mockReturnValue(pointerCollisions);
    dndKit.closestCenter.mockReturnValue(centerCollisions);

    const result = collisionDetection(createArgs('bookmark'));

    expect(result).toBe(pointerCollisions);
    expect(dndKit.pointerWithin).toHaveBeenCalledTimes(1);
    expect(dndKit.closestCenter).not.toHaveBeenCalled();
  });

  it('bookmarkドラッグ時はfolder drop targetのpointerWithin結果も返す', () => {
    const pointerCollisions: ReturnType<typeof collisionDetection> = [{ id: 'folder-1' }];
    const centerCollisions: ReturnType<typeof collisionDetection> = [{ id: 'bookmark-1' }];
    dndKit.pointerWithin.mockReturnValue(pointerCollisions);
    dndKit.closestCenter.mockReturnValue(centerCollisions);

    const result = collisionDetection(createArgs('bookmark'));

    expect(result).toBe(pointerCollisions);
    expect(dndKit.pointerWithin).toHaveBeenCalledTimes(1);
    expect(dndKit.closestCenter).not.toHaveBeenCalled();
  });

  it('bookmarkドラッグ時にpointerWithinが空ならbookmarkのみでclosestCenterを呼ぶ', () => {
    const bookmarkContainer = makeContainer('bookmark-1', 'bookmark');
    const folderContainer = makeContainer('folder-1', 'folder');
    const pointerCollisions: ReturnType<typeof collisionDetection> = [];
    const bookmarkCollisions: ReturnType<typeof collisionDetection> = [{ id: 'bookmark-1' }];
    dndKit.pointerWithin.mockReturnValue(pointerCollisions);
    dndKit.closestCenter.mockReturnValue(bookmarkCollisions);

    const result = collisionDetection(createArgs('bookmark', [bookmarkContainer, folderContainer]));

    expect(result).toBe(bookmarkCollisions);
    expect(dndKit.closestCenter).toHaveBeenCalledTimes(1);
    const callArgs = dndKit.closestCenter.mock.calls[0][0];
    expect(callArgs.droppableContainers).toEqual([bookmarkContainer]);
    expect(callArgs.droppableContainers).not.toContain(folderContainer);
  });

  it('pointer/bookmarkの衝突がなければbookmarkドラッグはdrop targetなしにする', () => {
    const folderContainer = makeContainer('folder-1', 'folder');
    const pointerCollisions: ReturnType<typeof collisionDetection> = [];
    dndKit.pointerWithin.mockReturnValue(pointerCollisions);
    dndKit.closestCenter.mockReturnValue([]);

    const result = collisionDetection(createArgs('bookmark', [folderContainer]));

    expect(result).toEqual([]);
    expect(dndKit.closestCenter).toHaveBeenCalledTimes(1);
  });

  it('folderドラッグ時はclosestCenterを使う', () => {
    const centerCollisions: ReturnType<typeof collisionDetection> = [{ id: 'folder-1' }];
    dndKit.closestCenter.mockReturnValue(centerCollisions);

    const result = collisionDetection(createArgs('folder'));

    expect(result).toBe(centerCollisions);
    expect(dndKit.pointerWithin).not.toHaveBeenCalled();
    expect(dndKit.closestCenter).toHaveBeenCalledTimes(1);
  });

  it('folderドラッグ時はbookmarkドラッグと異なりコンテナを絞り込まずclosestCenterを使う', () => {
    // folder sort は同一 parentPath 内の SortableContext 全体を対象にするため
    // bookmark 用フィルタリングを行わず全コンテナで closestCenter を呼ぶ
    const bookmarkContainer = makeContainer('bookmark-1', 'bookmark');
    const folderContainer = makeContainer('folder-1', 'folder');
    dndKit.closestCenter.mockReturnValue([{ id: 'folder-1' }]);

    collisionDetection(createArgs('folder', [bookmarkContainer, folderContainer]));

    expect(dndKit.closestCenter).toHaveBeenCalledTimes(1);
    const passedContainers = dndKit.closestCenter.mock.calls[0][0].droppableContainers;
    expect(passedContainers).toContain(bookmarkContainer);
    expect(passedContainers).toContain(folderContainer);
  });
});

describe('collisionDetection（実座標データ / @dnd-kit/core 非モック）', () => {
  const makeRect = (l: number, t: number, w: number, h: number) => ({
    left: l,
    top: t,
    width: w,
    height: h,
    right: l + w,
    bottom: t + h,
  });

  const makeRealContainer = (id: string, type: string) =>
    ({
      id,
      data: { current: { type } },
      rect: { current: null },
      node: { current: null },
      disabled: false,
    }) as unknown as Parameters<typeof collisionDetection>[0]['droppableContainers'][number];

  beforeEach(async () => {
    vi.clearAllMocks();
    const actual = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core');
    dndKit.closestCenter.mockImplementation(actual.closestCenter);
    dndKit.pointerWithin.mockImplementation(actual.pointerWithin);
  });

  it('ポインタがフォルダ矩形内にある場合、bookmark ドラッグでフォルダが返る', () => {
    const result = collisionDetection({
      active: { id: 'b1', data: { current: { type: 'bookmark' } } },
      collisionRect: makeRect(50, 30, 10, 10),
      droppableRects: new Map([
        ['folder-1', makeRect(0, 0, 200, 100)],
        ['bookmark-2', makeRect(0, 150, 200, 40)],
      ]),
      droppableContainers: [
        makeRealContainer('folder-1', 'folder'),
        makeRealContainer('bookmark-2', 'bookmark'),
      ],
      pointerCoordinates: { x: 55, y: 35 },
    } as unknown as Parameters<typeof collisionDetection>[0]);
    expect(result[0]?.id).toBe('folder-1');
  });

  it('ポインタがフォルダ矩形外にある場合、bookmark ドラッグでブックマークが返る（フォルダは返らない）', () => {
    const result = collisionDetection({
      active: { id: 'b1', data: { current: { type: 'bookmark' } } },
      collisionRect: makeRect(50, 160, 10, 10),
      droppableRects: new Map([
        ['folder-1', makeRect(0, 0, 200, 100)],
        ['bookmark-2', makeRect(0, 150, 200, 40)],
      ]),
      droppableContainers: [
        makeRealContainer('folder-1', 'folder'),
        makeRealContainer('bookmark-2', 'bookmark'),
      ],
      pointerCoordinates: { x: 55, y: 165 },
    } as unknown as Parameters<typeof collisionDetection>[0]);
    expect(result[0]?.id).toBe('bookmark-2');
    expect(result.map((r) => r.id)).not.toContain('folder-1');
  });
});
