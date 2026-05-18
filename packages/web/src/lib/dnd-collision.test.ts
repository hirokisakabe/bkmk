import { beforeEach, describe, expect, it, vi } from 'vitest';

const dndKit = vi.hoisted(() => ({
  closestCenter: vi.fn(),
  pointerWithin: vi.fn(),
}));

vi.mock('@dnd-kit/core', () => dndKit);

import { collisionDetection } from './dnd-collision';

const createArgs = (type: string) =>
  ({
    active: {
      data: {
        current: { type },
      },
    },
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

  it('bookmarkドラッグ時にpointerWithinが空ならclosestCenterにフォールバックする', () => {
    const pointerCollisions: ReturnType<typeof collisionDetection> = [];
    const centerCollisions: ReturnType<typeof collisionDetection> = [{ id: 'folder-1' }];
    dndKit.pointerWithin.mockReturnValue(pointerCollisions);
    dndKit.closestCenter.mockReturnValue(centerCollisions);

    const result = collisionDetection(createArgs('bookmark'));

    expect(result).toBe(centerCollisions);
    expect(dndKit.pointerWithin).toHaveBeenCalledTimes(1);
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
});
