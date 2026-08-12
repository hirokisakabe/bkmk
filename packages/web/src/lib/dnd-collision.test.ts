import { beforeEach, describe, expect, it, vi } from 'vitest';

const dndKit = vi.hoisted(() => ({
  closestCenter: vi.fn(),
}));

vi.mock('@dnd-kit/core', () => dndKit);

import { collisionDetection } from './dnd-collision';

const makeRect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

const makeContainer = (id: string, type: string) =>
  ({ id, data: { current: { type } } }) as unknown as Parameters<
    typeof collisionDetection
  >[0]['droppableContainers'][number];

const createArgs = ({
  activeType = 'bookmark',
  collisionRect = makeRect(0, 0, 20, 20),
  containers = [],
  rects = [],
  pointerCoordinates,
}: {
  activeType?: string;
  collisionRect?: ReturnType<typeof makeRect>;
  containers?: ReturnType<typeof makeContainer>[];
  rects?: [string, ReturnType<typeof makeRect>][];
  pointerCoordinates?: { x: number; y: number };
} = {}) =>
  ({
    active: { id: 'active', data: { current: { type: activeType } } },
    collisionRect,
    droppableContainers: containers,
    droppableRects: new Map(rects),
    pointerCoordinates,
  }) as unknown as Parameters<typeof collisionDetection>[0];

describe('collisionDetection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('カード中心がフォルダ内ならポインタが外側でもそのフォルダを返す', () => {
    const folder = makeContainer('folder-1', 'folder');
    const bookmark = makeContainer('bookmark-1', 'bookmark');

    const result = collisionDetection(
      createArgs({
        collisionRect: makeRect(80, 20, 40, 40),
        containers: [bookmark, folder],
        rects: [
          ['folder-1', makeRect(0, 0, 200, 100)],
          ['bookmark-1', makeRect(250, 0, 200, 100)],
        ],
        pointerCoordinates: { x: 240, y: 40 },
      }),
    );

    expect(result).toEqual([{ id: 'folder-1' }]);
    expect(dndKit.closestCenter).not.toHaveBeenCalled();
  });

  it('複数フォルダが重なる場合はカード中心に最も近い単一フォルダを安定して返す', () => {
    const wideFolder = makeContainer('folder-wide', 'folder');
    const narrowFolder = makeContainer('folder-narrow', 'folder');

    const args = createArgs({
      collisionRect: makeRect(90, 40, 20, 20),
      containers: [wideFolder, narrowFolder],
      rects: [
        ['folder-wide', makeRect(0, 0, 240, 100)],
        ['folder-narrow', makeRect(80, 25, 40, 50)],
      ],
    });

    expect(collisionDetection(args)).toEqual([{ id: 'folder-narrow' }]);
    expect(collisionDetection(args)).toEqual([{ id: 'folder-narrow' }]);
  });

  it('等距で重なるフォルダはコンテナ順をtie-breakにして単一フォルダを返す', () => {
    const first = makeContainer('folder-first', 'folder');
    const second = makeContainer('folder-second', 'folder');

    const result = collisionDetection(
      createArgs({
        collisionRect: makeRect(90, 40, 20, 20),
        containers: [first, second],
        rects: [
          ['folder-first', makeRect(0, 0, 200, 100)],
          ['folder-second', makeRect(0, 0, 200, 100)],
        ],
      }),
    );

    expect(result).toEqual([{ id: 'folder-first' }]);
  });

  it('カード中心がフォルダ外ならフォルダ移動にせずbookmarkだけでclosestCenterを使う', () => {
    const folder = makeContainer('folder-1', 'folder');
    const bookmark = makeContainer('bookmark-1', 'bookmark');
    const collisions: ReturnType<typeof collisionDetection> = [{ id: 'bookmark-1' }];
    dndKit.closestCenter.mockReturnValue(collisions);

    const result = collisionDetection(
      createArgs({
        collisionRect: makeRect(195, 40, 20, 20),
        containers: [bookmark, folder],
        rects: [
          ['folder-1', makeRect(0, 0, 200, 100)],
          ['bookmark-1', makeRect(250, 0, 200, 100)],
        ],
      }),
    );

    expect(result).toBe(collisions);
    expect(dndKit.closestCenter).toHaveBeenCalledTimes(1);
    expect(dndKit.closestCenter.mock.calls[0][0].droppableContainers).toEqual([bookmark]);
  });

  it('bookmark候補がなくカード中心もフォルダ外なら空配列を返す', () => {
    const folder = makeContainer('folder-1', 'folder');

    const result = collisionDetection(
      createArgs({
        collisionRect: makeRect(250, 0, 20, 20),
        containers: [folder],
        rects: [['folder-1', makeRect(0, 0, 200, 100)]],
      }),
    );

    expect(result).toEqual([]);
    expect(dndKit.closestCenter).not.toHaveBeenCalled();
  });

  it('bookmarkソートはpointerCoordinatesに関係なく同じcollisionRectで同じ候補を渡す', () => {
    const first = makeContainer('bookmark-1', 'bookmark');
    const second = makeContainer('bookmark-2', 'bookmark');
    dndKit.closestCenter.mockReturnValue([{ id: 'bookmark-2' }]);
    const common = {
      collisionRect: makeRect(190, 0, 100, 100),
      containers: [first, second],
      rects: [
        ['bookmark-1', makeRect(0, 0, 100, 100)],
        ['bookmark-2', makeRect(220, 0, 100, 100)],
      ] as [string, ReturnType<typeof makeRect>][],
    };

    const fromLeftHandle = collisionDetection(
      createArgs({ ...common, pointerCoordinates: { x: 195, y: 50 } }),
    );
    const fromRightHandle = collisionDetection(
      createArgs({ ...common, pointerCoordinates: { x: 285, y: 50 } }),
    );

    expect(fromLeftHandle).toEqual([{ id: 'bookmark-2' }]);
    expect(fromRightHandle).toEqual([{ id: 'bookmark-2' }]);
    expect(dndKit.closestCenter).toHaveBeenCalledTimes(2);
  });

  it('folderドラッグ時は既存どおり全コンテナでclosestCenterを使う', () => {
    const bookmark = makeContainer('bookmark-1', 'bookmark');
    const folder = makeContainer('folder-1', 'folder');
    const collisions: ReturnType<typeof collisionDetection> = [{ id: 'folder-1' }];
    dndKit.closestCenter.mockReturnValue(collisions);
    const args = createArgs({ activeType: 'folder', containers: [bookmark, folder] });

    expect(collisionDetection(args)).toBe(collisions);
    expect(dndKit.closestCenter).toHaveBeenCalledWith(args);
  });
});
