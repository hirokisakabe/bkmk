import { describe, expect, it } from 'vitest';

import { collisionDetection } from './dnd-collision';

const makeRect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

const makeContainer = (id: string) =>
  ({ id, data: { current: { type: 'bookmark' } } }) as unknown as Parameters<
    typeof collisionDetection
  >[0]['droppableContainers'][number];

describe('collisionDetection with real dnd-kit closestCenter', () => {
  const active = makeContainer('active');
  const adjacent = makeContainer('bookmark-adjacent');
  const containers = [active, adjacent];
  const rects = new Map([
    ['active', makeRect(0, 0, 100, 100)],
    ['bookmark-adjacent', makeRect(100, 0, 100, 100)],
  ]);

  const detectAtCenter = (
    centerX: number,
    pointerCoordinates: { x: number; y: number } = { x: centerX, y: 50 },
    orderedContainers = containers,
  ) =>
    collisionDetection({
      active: { id: 'active', data: { current: { type: 'bookmark' } } },
      collisionRect: makeRect(centerX - 50, 0, 100, 100),
      droppableContainers: orderedContainers,
      droppableRects: rects,
      pointerCoordinates,
    } as unknown as Parameters<typeof collisionDetection>[0]);

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
