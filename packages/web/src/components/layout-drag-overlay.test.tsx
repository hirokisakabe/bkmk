import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Bookmark } from '../types';

const dndState = vi.hoisted(() => ({
  active: undefined as unknown,
  over: undefined as unknown,
  activatorEvent: undefined as unknown,
}));

vi.mock('@dnd-kit/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@dnd-kit/core')>()),
  useDndContext: () => dndState,
}));

import { BookmarkDragOverlayContent } from './layout';

const bookmark: Bookmark = {
  id: 'bookmark-1',
  userId: 'user-1',
  folderPath: '/source',
  url: 'https://example.com',
  title: 'Example',
  description: null,
  imageUrl: null,
  faviconUrl: null,
  position: 0,
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const activeBookmark = {
  id: bookmark.id,
  data: { current: { type: 'bookmark', bookmark } },
  rect: { current: { initial: { left: 100, top: 200, width: 240, height: 120 } } },
};

describe('BookmarkDragOverlayContent', () => {
  beforeEach(() => {
    dndState.active = activeBookmark;
    dndState.over = undefined;
    dndState.activatorEvent = new MouseEvent('pointerdown', {
      clientX: 325,
      clientY: 210,
    });
  });

  it('sidebar内ならfolder row上かどうかに関係なくoverlay内部だけを縮小する', () => {
    render(<BookmarkDragOverlayContent isOverSidebar />);

    const overlayCard = screen.getByTestId('bookmark-drag-overlay-card');
    expect(overlayCard).toHaveClass('scale-[0.55]');
    expect(overlayCard).toHaveClass(
      'transition-transform',
      'duration-150',
      'motion-reduce:transition-none',
    );
    expect(overlayCard.parentElement).toHaveStyle({ width: '240px' });
  });

  it('sidebar外ではfolder rowがoverでも縮小しない', () => {
    dndState.over = {
      data: {
        current: {
          type: 'folder',
          folder: { path: '/destination' },
          isBookmarkFolderDropTarget: true,
        },
      },
    };
    render(<BookmarkDragOverlayContent />);

    expect(screen.getByTestId('bookmark-drag-overlay-card')).toHaveClass('scale-100');
  });

  it('掴んだ位置を縮小原点にしてcursorとの位置関係を維持する', () => {
    render(<BookmarkDragOverlayContent isOverSidebar />);

    expect(screen.getByTestId('bookmark-drag-overlay-card')).toHaveStyle({
      transformOrigin: '225px 10px',
    });
  });
});
