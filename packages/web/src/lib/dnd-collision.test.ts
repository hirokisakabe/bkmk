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

const makeContainer = (id: string, type: string, data: Record<string, unknown> = {}) =>
  ({ id, data: { current: { type, ...data } } }) as unknown as Parameters<
    typeof collisionDetection
  >[0]['droppableContainers'][number];

const makeFolderDropContainer = (id: string, type = 'folder') =>
  makeContainer(id, type, { isBookmarkFolderDropTarget: true });

const createArgs = ({
  activeType = 'bookmark',
  collisionRect = makeRect(0, 0, 20, 20),
  containers = [],
  rects = [],
  pointerCoordinates,
  activeFolderPath,
}: {
  activeType?: string;
  collisionRect?: ReturnType<typeof makeRect>;
  containers?: ReturnType<typeof makeContainer>[];
  rects?: [string, ReturnType<typeof makeRect>][];
  pointerCoordinates?: { x: number; y: number };
  activeFolderPath?: string | null;
} = {}) =>
  ({
    active: {
      id: 'active',
      data: {
        current: {
          type: activeType,
          ...(activeFolderPath !== undefined ? { bookmark: { folderPath: activeFolderPath } } : {}),
        },
      },
    },
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
    const folder = makeFolderDropContainer('folder-drop-1');
    const bookmark = makeContainer('bookmark-1', 'bookmark');

    const result = collisionDetection(
      createArgs({
        collisionRect: makeRect(80, 20, 40, 40),
        containers: [bookmark, folder],
        rects: [
          ['folder-drop-1', makeRect(0, 0, 200, 100)],
          ['bookmark-1', makeRect(250, 0, 200, 100)],
        ],
        pointerCoordinates: { x: 240, y: 40 },
      }),
    );

    expect(result).toEqual([{ id: 'folder-drop-1' }]);
    expect(dndKit.closestCenter).not.toHaveBeenCalled();
  });

  it('ポインタがフォルダ内ならカード中心が外側でもそのフォルダを返す', () => {
    const folder = makeFolderDropContainer('folder-drop-1');
    const bookmark = makeContainer('bookmark-1', 'bookmark');

    const result = collisionDetection(
      createArgs({
        collisionRect: makeRect(240, 20, 40, 40),
        containers: [bookmark, folder],
        rects: [
          ['folder-drop-1', makeRect(0, 0, 200, 100)],
          ['bookmark-1', makeRect(250, 0, 200, 100)],
        ],
        pointerCoordinates: { x: 180, y: 40 },
      }),
    );

    expect(result).toEqual([{ id: 'folder-drop-1' }]);
    expect(dndKit.closestCenter).not.toHaveBeenCalled();
  });

  it('複数フォルダが重なる場合はカード中心に最も近い単一フォルダを安定して返す', () => {
    const wideFolder = makeFolderDropContainer('folder-wide');
    const narrowFolder = makeFolderDropContainer('folder-narrow');

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
    const first = makeFolderDropContainer('folder-first');
    const second = makeFolderDropContainer('folder-second');

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

  it('ポインタとカード中心が別のフォルダ内ならポインタ側を優先する', () => {
    const pointerFolder = makeFolderDropContainer('folder-pointer');
    const centerFolder = makeFolderDropContainer('folder-center');

    const result = collisionDetection(
      createArgs({
        collisionRect: makeRect(290, 40, 20, 20),
        containers: [pointerFolder, centerFolder],
        rects: [
          ['folder-pointer', makeRect(0, 0, 200, 100)],
          ['folder-center', makeRect(200, 0, 200, 100)],
        ],
        pointerCoordinates: { x: 100, y: 50 },
      }),
    );

    expect(result).toEqual([{ id: 'folder-pointer' }]);
  });

  it('ポインタとカード中心が外でもカードとの重なりが最大のフォルダを返す', () => {
    const smallOverlap = makeFolderDropContainer('folder-small-overlap');
    const largeOverlap = makeFolderDropContainer('folder-large-overlap');

    const result = collisionDetection(
      createArgs({
        collisionRect: makeRect(80, 35, 120, 90),
        containers: [smallOverlap, largeOverlap],
        rects: [
          ['folder-small-overlap', makeRect(0, 0, 100, 40)],
          ['folder-large-overlap', makeRect(0, 100, 100, 40)],
        ],
        pointerCoordinates: { x: 220, y: 120 },
      }),
    );

    expect(result).toEqual([{ id: 'folder-large-overlap' }]);
  });

  it('カード中心とポインタがフォルダ外ならbookmarkだけでclosestCenterを使う', () => {
    const folder = makeFolderDropContainer('folder-drop-1');
    const bookmark = makeContainer('bookmark-1', 'bookmark');
    const collisions: ReturnType<typeof collisionDetection> = [{ id: 'bookmark-1' }];
    dndKit.closestCenter.mockReturnValue(collisions);

    const result = collisionDetection(
      createArgs({
        collisionRect: makeRect(205, 40, 20, 20),
        containers: [bookmark, folder],
        rects: [
          ['folder-drop-1', makeRect(0, 0, 200, 100)],
          ['bookmark-1', makeRect(250, 0, 200, 100)],
        ],
        pointerCoordinates: { x: 230, y: 40 },
      }),
    );

    expect(result).toBe(collisions);
    expect(dndKit.closestCenter).toHaveBeenCalledTimes(1);
    expect(dndKit.closestCenter.mock.calls[0][0].droppableContainers).toEqual([bookmark]);
  });

  it('bookmark同士の衝突候補をactiveと同じfolderPathだけに限定する', () => {
    const sameGroup = makeContainer('bookmark-same', 'bookmark', {
      bookmark: { folderPath: '/work' },
    });
    const otherGroup = makeContainer('bookmark-other', 'bookmark', {
      bookmark: { folderPath: '/other' },
    });
    dndKit.closestCenter.mockReturnValue([{ id: 'bookmark-same' }]);

    collisionDetection(
      createArgs({
        activeFolderPath: '/work',
        containers: [sameGroup, otherGroup],
      }),
    );

    expect(dndKit.closestCenter.mock.calls[0][0].droppableContainers).toEqual([sameGroup]);
  });

  it('bookmark候補がなくカード中心もフォルダ外なら空配列を返す', () => {
    const folder = makeFolderDropContainer('folder-drop-1');

    const result = collisionDetection(
      createArgs({
        collisionRect: makeRect(250, 0, 20, 20),
        containers: [folder],
        rects: [['folder-drop-1', makeRect(0, 0, 200, 100)]],
      }),
    );

    expect(result).toEqual([]);
    expect(dndKit.closestCenter).not.toHaveBeenCalled();
  });

  it('ポインタだけが未分類row内にある場合もfolder drop候補にする', () => {
    const unknown = makeContainer('unknown-drop-target', 'search-result', {
      isBookmarkFolderDropTarget: true,
    });
    const uncategorized = makeFolderDropContainer(
      'folder-drop-uncategorized',
      'folder-uncategorized',
    );

    const result = collisionDetection(
      createArgs({
        collisionRect: makeRect(140, 40, 20, 20),
        containers: [unknown, uncategorized],
        rects: [
          ['unknown-drop-target', makeRect(0, 0, 100, 100)],
          ['folder-drop-uncategorized', makeRect(0, 0, 100, 100)],
        ],
        pointerCoordinates: { x: 50, y: 50 },
      }),
    );

    expect(result).toEqual([{ id: 'folder-drop-uncategorized' }]);
  });

  it('操作不能なmobile sidebar内のfolder targetはbookmarkソートから除外する', () => {
    const folder = makeFolderDropContainer('folder-drop-hidden');
    const bookmark = makeContainer('bookmark-1', 'bookmark');
    const aside = document.createElement('aside');
    const row = document.createElement('button');
    aside.style.pointerEvents = 'none';
    aside.append(row);
    Object.assign(folder, { node: { current: row } });
    const collisions: ReturnType<typeof collisionDetection> = [{ id: 'bookmark-1' }];
    dndKit.closestCenter.mockReturnValue(collisions);

    const result = collisionDetection(
      createArgs({
        collisionRect: makeRect(0, 0, 100, 100),
        containers: [bookmark, folder],
        rects: [
          ['folder-drop-hidden', makeRect(0, 0, 100, 100)],
          ['bookmark-1', makeRect(0, 0, 100, 100)],
        ],
        pointerCoordinates: { x: 50, y: 50 },
      }),
    );

    expect(result).toBe(collisions);
    expect(dndKit.closestCenter.mock.calls[0][0].droppableContainers).toEqual([bookmark]);
  });

  it('expanded parentのsortable wrapperを除外し、row-onlyのchild targetを返す', () => {
    const parentSortableWrapper = makeContainer('folder-parent', 'folder');
    const parentRow = makeFolderDropContainer('folder-drop-parent');
    const childRow = makeFolderDropContainer('folder-drop-child');

    const result = collisionDetection(
      createArgs({
        collisionRect: makeRect(80, 54, 40, 40),
        containers: [parentSortableWrapper, parentRow, childRow],
        rects: [
          // Expanded descendants make the sortable wrapper cover both rows.
          ['folder-parent', makeRect(0, 0, 200, 100)],
          ['folder-drop-parent', makeRect(0, 0, 200, 44)],
          ['folder-drop-child', makeRect(0, 44, 200, 44)],
        ],
      }),
    );

    expect(result).toEqual([{ id: 'folder-drop-child' }]);
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

  it('folderドラッグ時はrow-only targetを除外してsortable wrapperだけでclosestCenterを使う', () => {
    const bookmark = makeContainer('bookmark-1', 'bookmark');
    const folder = makeContainer('folder-1', 'folder');
    const folderRow = makeFolderDropContainer('folder-drop-1');
    const collisions: ReturnType<typeof collisionDetection> = [{ id: 'folder-1' }];
    dndKit.closestCenter.mockReturnValue(collisions);
    const args = createArgs({
      activeType: 'folder',
      containers: [bookmark, folder, folderRow],
    });

    expect(collisionDetection(args)).toBe(collisions);
    expect(dndKit.closestCenter).toHaveBeenCalledWith({
      ...args,
      droppableContainers: [folder],
    });
  });
});
