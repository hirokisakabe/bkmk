import { closestCenter, type CollisionDetection } from '@dnd-kit/core';

export const collisionDetection: CollisionDetection = (args) => {
  const activeType = args.active.data.current?.type;

  if (activeType === 'bookmark') {
    const bookmarkContainers = args.droppableContainers.filter(
      (container) => container.data.current?.type === 'bookmark',
    );
    const folderContainers = args.droppableContainers.filter((container) => {
      if (
        container.data.current?.isBookmarkFolderDropTarget !== true ||
        (container.data.current.type !== 'folder' &&
          container.data.current.type !== 'folder-uncategorized')
      ) {
        return false;
      }

      // The mobile sidebar remains mounted while translated off-screen. Its cached droppable
      // rects must not intercept bookmark sorting until the sidebar is actually interactive.
      const sidebar = container.node?.current?.closest('aside');
      return !sidebar || getComputedStyle(sidebar).pointerEvents !== 'none';
    });

    const activeCenter = {
      x: args.collisionRect.left + args.collisionRect.width / 2,
      y: args.collisionRect.top + args.collisionRect.height / 2,
    };
    const pointer = args.pointerCoordinates;

    // Folder sorting measures wrappers that can include expanded descendants. Bookmark drops
    // use separately registered row-only targets so an ancestor cannot cover its child rows.
    const containingFolders = folderContainers
      .map((container, index) => {
        const rect = args.droppableRects.get(container.id);
        if (!rect) {
          return null;
        }

        const containsActiveCenter =
          activeCenter.x >= rect.left &&
          activeCenter.x <= rect.right &&
          activeCenter.y >= rect.top &&
          activeCenter.y <= rect.bottom;
        const containsPointer =
          pointer !== null &&
          pointer !== undefined &&
          pointer.x >= rect.left &&
          pointer.x <= rect.right &&
          pointer.y >= rect.top &&
          pointer.y <= rect.bottom;
        const intersectionWidth = Math.max(
          0,
          Math.min(args.collisionRect.right, rect.right) -
            Math.max(args.collisionRect.left, rect.left),
        );
        const intersectionHeight = Math.max(
          0,
          Math.min(args.collisionRect.bottom, rect.bottom) -
            Math.max(args.collisionRect.top, rect.top),
        );
        const intersectionArea = intersectionWidth * intersectionHeight;
        if (!containsActiveCenter && !containsPointer && intersectionArea === 0) return null;

        const dx = activeCenter.x - (rect.left + rect.width / 2);
        const dy = activeCenter.y - (rect.top + rect.height / 2);
        const pointerDx = pointer ? pointer.x - (rect.left + rect.width / 2) : 0;
        const pointerDy = pointer ? pointer.y - (rect.top + rect.height / 2) : 0;
        return {
          container,
          containsActiveCenter,
          containsPointer,
          intersectionArea,
          centerDistance: dx * dx + dy * dy,
          pointerDistance: pointerDx * pointerDx + pointerDy * pointerDy,
          index,
        };
      })
      .filter((candidate) => candidate !== null)
      .sort((a, b) => {
        const aPriority = a.containsPointer ? 0 : a.containsActiveCenter ? 1 : 2;
        const bPriority = b.containsPointer ? 0 : b.containsActiveCenter ? 1 : 2;
        if (aPriority !== bPriority) return aPriority - bPriority;
        if (aPriority === 0) {
          return a.pointerDistance - b.pointerDistance || a.index - b.index;
        }
        if (aPriority === 1) {
          return a.centerDistance - b.centerDistance || a.index - b.index;
        }
        return (
          b.intersectionArea - a.intersectionArea ||
          a.centerDistance - b.centerDistance ||
          a.index - b.index
        );
      });

    const folder = containingFolders[0]?.container;
    if (folder) return [{ id: folder.id }];

    // closestCenter compares the translated card center with each card center, so sorting
    // does not depend on where the pointer happened to grab the active card.
    if (bookmarkContainers.length > 0) {
      return closestCenter({ ...args, droppableContainers: bookmarkContainers });
    }

    return [];
  }

  if (activeType === 'folder') {
    // Row-only bookmark targets share folder data with their sortable wrapper. Keep them out of
    // folder collisions so SortableContext always receives one of its wrapper IDs.
    const sortableFolderContainers = args.droppableContainers.filter(
      (container) =>
        container.data.current?.type === 'folder' &&
        container.data.current.isBookmarkFolderDropTarget !== true,
    );
    return closestCenter({ ...args, droppableContainers: sortableFolderContainers });
  }

  return closestCenter(args);
};
