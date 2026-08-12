import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return { ...actual, closestCenter: vi.fn(actual.closestCenter) };
});

import * as dndKit from '@dnd-kit/core';

import { collisionDetection } from './dnd-collision';

const actualDndKit = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core');

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
    vi.mocked(dndKit.closestCenter).mockReset().mockImplementation(actualDndKit.closestCenter);
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
    vi.mocked(dndKit.closestCenter).mockReturnValue(collisions);

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

  it('folder候補はfolderとfolder-uncategorizedだけに限定する', () => {
    const unknown = makeContainer('unknown-drop-target', 'search-result');
    const uncategorized = makeContainer('folder-drop-uncategorized', 'folder-uncategorized');

    const result = collisionDetection(
      createArgs({
        collisionRect: makeRect(40, 40, 20, 20),
        containers: [unknown, uncategorized],
        rects: [
          ['unknown-drop-target', makeRect(0, 0, 100, 100)],
          ['folder-drop-uncategorized', makeRect(0, 0, 100, 100)],
        ],
      }),
    );

    expect(result).toEqual([{ id: 'folder-drop-uncategorized' }]);
  });

  it('bookmarkソートはpointerCoordinatesに関係なく同じcollisionRectで同じ候補を渡す', () => {
    const first = makeContainer('bookmark-1', 'bookmark');
    const second = makeContainer('bookmark-2', 'bookmark');
    vi.mocked(dndKit.closestCenter).mockReturnValue([{ id: 'bookmark-2' }]);
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
    vi.mocked(dndKit.closestCenter).mockReturnValue(collisions);
    const args = createArgs({ activeType: 'folder', containers: [bookmark, folder] });

    expect(collisionDetection(args)).toBe(collisions);
    expect(dndKit.closestCenter).toHaveBeenCalledWith(args);
  });

  describe('実dnd-kit closestCenterの座標境界', () => {
    const active = makeContainer('active', 'bookmark');
    const adjacent = makeContainer('bookmark-adjacent', 'bookmark');
    const containers = [active, adjacent];
    const rects: [string, ReturnType<typeof makeRect>][] = [
      ['active', makeRect(0, 0, 100, 100)],
      ['bookmark-adjacent', makeRect(100, 0, 100, 100)],
    ];

    const detectAtCenter = (
      centerX: number,
      pointerCoordinates: { x: number; y: number } = { x: centerX, y: 50 },
      orderedContainers = containers,
    ) =>
      collisionDetection(
        createArgs({
          collisionRect: makeRect(centerX - 50, 0, 100, 100),
          containers: orderedContainers,
          rects,
          pointerCoordinates,
        }),
      );

    it('隣接cardとの中点直前はactive自身、中点直後は隣接cardを返す', () => {
      expect(detectAtCenter(99.99)[0]?.id).toBe('active');
      expect(detectAtCenter(100.01)[0]?.id).toBe('bookmark-adjacent');
    });

    it('隣接cardとの中点ちょうどはdroppable containerの登録順で決まる', () => {
      expect(detectAtCenter(100)[0]?.id).toBe('active');
      expect(detectAtCenter(100, { x: 100, y: 50 }, [adjacent, active])[0]?.id).toBe(
        'bookmark-adjacent',
      );
    });

    it('collisionRectが同じならpointerだけ変えても判定は変わらない', () => {
      const fromActiveSide = detectAtCenter(100.01, { x: 1, y: 1 });
      const fromAdjacentSide = detectAtCenter(100.01, { x: 199, y: 99 });

      expect(fromActiveSide[0]?.id).toBe('bookmark-adjacent');
      expect(fromAdjacentSide[0]?.id).toBe('bookmark-adjacent');
    });
  });
});
