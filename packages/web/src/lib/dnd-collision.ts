import { closestCenter, type CollisionDetection, pointerWithin } from '@dnd-kit/core';

export const collisionDetection: CollisionDetection = (args) => {
  const activeType = args.active.data.current?.type;

  if (activeType === 'bookmark') {
    const pointerCollisions = pointerWithin(args);
    return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
  }

  return closestCenter(args);
};
