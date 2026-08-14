import { DndContext } from '@dnd-kit/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UNCATEGORIZED_VIEW, type BookmarkView } from '../lib/constants';
import type { Folder } from '../types';
import { FolderTree } from './folder-tree';

const longFolderName = '同じ接頭辞から始まるとても長いフォルダ名プロジェクトアルファ';
const folders: Folder[] = [
  {
    id: 'folder-1',
    userId: 'user-1',
    name: '仕事',
    path: '/仕事',
    parentPath: null,
    position: 0,
    deletedAt: null,
    createdAt: '2026-08-12T00:00:00.000Z',
  },
  {
    id: 'folder-long',
    userId: 'user-1',
    name: longFolderName,
    path: `/${longFolderName}`,
    parentPath: null,
    position: 1,
    deletedAt: null,
    createdAt: '2026-08-12T00:00:00.000Z',
  },
];

const captureCreateFolderDialogProps = vi.hoisted(() =>
  vi.fn<(props: { parentPath: string | null }) => void>(),
);

vi.mock('../hooks/use-folders', async (importOriginal) => {
  const original = await importOriginal<typeof import('../hooks/use-folders')>();
  return {
    ...original,
    useAllFolders: () => ({ data: folders, isLoading: false }),
  };
});

vi.mock('../hooks/use-delete-folder', () => ({
  useDeleteFolder: () => ({ mutate: vi.fn() }),
}));

vi.mock('./folder-dialogs', () => ({
  CreateFolderDialog: (props: { parentPath: string | null }) => {
    captureCreateFolderDialogProps(props);
    return <div data-testid="create-folder-dialog" />;
  },
  MoveFolderDialog: () => null,
  RenameFolderDialog: () => null,
}));

function renderFolderTree(selectedFolder: string | null = null, selectedView?: BookmarkView) {
  return render(
    <DndContext>
      <FolderTree
        selectedFolder={selectedFolder}
        selectedView={selectedView}
        onSelectFolder={vi.fn()}
        onSelectUncategorized={vi.fn()}
      />
    </DndContext>,
  );
}

describe('FolderTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('「すべて」と「未分類」の選択行が同じ横幅を持つ', () => {
    renderFolderTree();

    expect(screen.getByRole('button', { name: 'すべて' })).toHaveClass('w-full');
    expect(screen.getByRole('button', { name: '未分類' })).toHaveClass('w-full');
  });

  it('フォルダセクションの作成ボタンからトップ階層フォルダを作成できる', async () => {
    const user = userEvent.setup();
    renderFolderTree(null, UNCATEGORIZED_VIEW);

    const heading = screen.getByRole('heading', { name: 'フォルダ' });
    const createButton = screen.getByRole('button', { name: '新しいフォルダを作成' });

    expect(heading.parentElement).toContainElement(createButton);
    expect(createButton).toHaveClass('h-11', 'w-11');

    await user.click(createButton);

    expect(screen.getByTestId('create-folder-dialog')).toBeInTheDocument();
    expect(captureCreateFolderDialogProps.mock.lastCall?.[0].parentPath).toBeNull();
  });

  it('フォルダのコンテキストメニューから子フォルダを作成できる', async () => {
    const user = userEvent.setup();
    renderFolderTree();

    fireEvent.contextMenu(screen.getByText('仕事'));

    const createChildItem = await screen.findByRole('menuitem', { name: '新しいフォルダ' });
    await user.click(createChildItem);

    await waitFor(() => {
      expect(screen.getByTestId('create-folder-dialog')).toBeInTheDocument();
      expect(captureCreateFolderDialogProps.mock.lastCall?.[0].parentPath).toBe('/仕事');
    });
  });

  it('長いフォルダ名を handle の手前で省略し、pointer と focus で全文を表示する', async () => {
    renderFolderTree();

    const nameButton = screen.getByRole('button', { name: longFolderName });
    const name = screen.getByText(longFolderName);
    const row = screen.getByTestId('folder-drop-target-folder-long');
    expect(nameButton).toHaveClass('min-w-0', 'flex-1');
    expect(name).toHaveClass('min-w-0', 'flex-1', 'truncate');
    expect(row).toContainElement(screen.getByTestId('folder-drag-handle-folder-long'));
    markAsOverflowing(name);

    fireEvent.pointerEnter(nameButton);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(longFolderName);
    fireEvent.pointerLeave(nameButton);

    nameButton.focus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(longFolderName);
    expect(nameButton).not.toHaveAttribute('title');
  });
});

function markAsOverflowing(element: HTMLElement) {
  Object.defineProperties(element, {
    scrollWidth: { configurable: true, value: 320 },
    clientWidth: { configurable: true, value: 100 },
  });
  fireEvent(window, new Event('resize'));
}
