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

const createArgs = (
  type: string,
  droppableContainers: ReturnType<typeof makeContainer>[] = [],
) =>
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

  it('bookmarkドラッグ時にpointerWithinが空ならbookmarkのみでclosestCenterを呼ぶ', () => {
    const bookmarkContainer = makeContainer('bookmark-1', 'bookmark');
    const folderContainer = makeContainer('folder-1', 'folder');
    const pointerCollisions: ReturnType<typeof collisionDetection> = [];
    const bookmarkCollisions: ReturnType<typeof collisionDetection> = [{ id: 'bookmark-1' }];
    dndKit.pointerWithin.mockReturnValue(pointerCollisions);
    dndKit.closestCenter.mockReturnValue(bookmarkCollisions);

    const result = collisionDetection(
      createArgs('bookmark', [bookmarkContainer, folderContainer]),
    );

    expect(result).toBe(bookmarkCollisions);
    expect(dndKit.closestCenter).toHaveBeenCalledTimes(1);
    const callArgs = dndKit.closestCenter.mock.calls[0][0];
    expect(callArgs.droppableContainers).toEqual([bookmarkContainer]);
    expect(callArgs.droppableContainers).not.toContain(folderContainer);
  });

  it('bookmarkドロッパブルがなければclosestCenter全体にフォールバックする', () => {
    const folderContainer = makeContainer('folder-1', 'folder');
    const pointerCollisions: ReturnType<typeof collisionDetection> = [];
    const folderCollisions: ReturnType<typeof collisionDetection> = [{ id: 'folder-1' }];
    dndKit.pointerWithin.mockReturnValue(pointerCollisions);
    dndKit.closestCenter.mockReturnValueOnce([]).mockReturnValueOnce(folderCollisions);

    const result = collisionDetection(createArgs('bookmark', [folderContainer]));

    expect(result).toBe(folderCollisions);
    expect(dndKit.closestCenter).toHaveBeenCalledTimes(2);
  });

  it('folderドラッグ時はclosestCenterを使う', () => {
    const centerCollisions: ReturnType<typeof collisionDetection> = [{ id: 'folder-1' }];
    dndKit.closestCenter.mockReturnValue(centerCollisions);

    const result = collisionDetection(createArgs('folder'));

    expect(result).toBe(centerCollisions);
    expect(dndKit.pointerWithin).not.toHaveBeenCalled();
    expect(dndKit.closestCenter).toHaveBeenCalledTimes(1);
  });
});
