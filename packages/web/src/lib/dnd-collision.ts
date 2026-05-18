import { closestCenter, type CollisionDetection, pointerWithin } from '@dnd-kit/core';

export const collisionDetection: CollisionDetection = (args) => {
  const activeType = args.active.data.current?.type;

  if (activeType === 'bookmark') {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;

    const bookmarkOnly = args.droppableContainers.filter(
      (c) => c.data.current?.type === 'bookmark',
    );
    const bookmarkCollisions = closestCenter({ ...args, droppableContainers: bookmarkOnly });
    if (bookmarkCollisions.length > 0) return bookmarkCollisions;

    return closestCenter(args);
  }

  return closestCenter(args);
};
