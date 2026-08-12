import { closestCenter, type CollisionDetection } from '@dnd-kit/core';

export const collisionDetection: CollisionDetection = (args) => {
  const activeType = args.active.data.current?.type;

  if (activeType === 'bookmark') {
    const bookmarkContainers = args.droppableContainers.filter(
      (container) => container.data.current?.type === 'bookmark',
    );
    const folderContainers = args.droppableContainers.filter(
      (container) =>
        container.data.current?.isBookmarkFolderDropTarget === true &&
        (container.data.current.type === 'folder' ||
          container.data.current.type === 'folder-uncategorized'),
    );

    const activeCenter = {
      x: args.collisionRect.left + args.collisionRect.width / 2,
      y: args.collisionRect.top + args.collisionRect.height / 2,
    };

    // Folder sorting measures wrappers that can include expanded descendants. Bookmark drops
    // use separately registered row-only targets so an ancestor cannot cover its child rows.
    const containingFolders = folderContainers
      .map((container, index) => {
        const rect = args.droppableRects.get(container.id);
        if (
          !rect ||
          activeCenter.x < rect.left ||
          activeCenter.x > rect.right ||
          activeCenter.y < rect.top ||
          activeCenter.y > rect.bottom
        ) {
          return null;
        }

        const dx = activeCenter.x - (rect.left + rect.width / 2);
        const dy = activeCenter.y - (rect.top + rect.height / 2);
        return { container, distance: dx * dx + dy * dy, index };
      })
      .filter((candidate) => candidate !== null)
      .sort((a, b) => a.distance - b.distance || a.index - b.index);

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
