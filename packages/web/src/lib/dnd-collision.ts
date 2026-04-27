import { closestCenter, type CollisionDetection, pointerWithin } from '@dnd-kit/core';

export const collisionDetection: CollisionDetection = (args) => {
  const activeType = args.active.data.current?.type;

  if (activeType === 'bookmark') {
    return pointerWithin(args);
  }

  return closestCenter(args);
};
