import { DndContext } from '@dnd-kit/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UNCATEGORIZED_FOLDER } from '../lib/constants';
import type { Folder } from '../types';
import { FolderTree } from './folder-tree';

const folders: Folder[] = [
  {
    id: 'folder-1',
    name: '仕事',
    path: '/仕事',
    parentPath: null,
    position: 0,
    createdAt: '2026-08-12T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z',
  },
];

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
  CreateFolderDialog: ({ parentPath }: { parentPath: string | null }) => (
    <div data-testid="create-folder-dialog" data-parent-path={parentPath ?? 'root'} />
  ),
  MoveFolderDialog: () => null,
  RenameFolderDialog: () => null,
}));

function renderFolderTree(selectedFolder: string | null = null) {
  return render(
    <DndContext>
      <FolderTree selectedFolder={selectedFolder} onSelectFolder={vi.fn()} />
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
    renderFolderTree(UNCATEGORIZED_FOLDER);

    const heading = screen.getByRole('heading', { name: 'フォルダ' });
    const createButton = screen.getByRole('button', { name: '新しいフォルダを作成' });

    expect(heading.parentElement).toContainElement(createButton);
    expect(createButton).toHaveClass('h-11', 'w-11');

    await user.click(createButton);

    expect(screen.getByTestId('create-folder-dialog')).toHaveAttribute('data-parent-path', 'root');
  });

  it('フォルダのコンテキストメニューから子フォルダを作成できる', async () => {
    const user = userEvent.setup();
    renderFolderTree();

    fireEvent.contextMenu(screen.getByText('仕事'));

    const createChildItem = await screen.findByRole('menuitem', { name: '新しいフォルダ' });
    await user.click(createChildItem);

    await waitFor(() => {
      expect(screen.getByTestId('create-folder-dialog')).toHaveAttribute(
        'data-parent-path',
        '/仕事',
      );
    });
  });
});
