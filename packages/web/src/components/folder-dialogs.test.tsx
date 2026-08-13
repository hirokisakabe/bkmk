import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../test/server';
import type { Bookmark, Folder } from '../types';
import { MoveBookmarkDialog, MoveFolderDialog } from './folder-dialogs';

const folders: Folder[] = [
  makeFolder('current', '/current', null),
  makeFolder('current-child', '/current/child', '/current'),
  makeFolder('projects', '/projects', null),
  makeFolder('frontend', '/projects/frontend', '/projects'),
  makeFolder('archive', '/archive', null),
];

const currentFolder = folders[0];
const bookmark: Bookmark = {
  id: 'bookmark-1',
  userId: 'test-user',
  folderPath: null,
  url: 'https://example.com',
  title: 'Example',
  description: null,
  imageUrl: null,
  faviconUrl: null,
  position: 0,
  deletedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('移動先選択ダイアログ', () => {
  it('フォルダ移動とブックマーク移動で共通の通常フォルダ行を表示する', async () => {
    const folderView = renderDialog(
      <MoveFolderDialog
        open
        onOpenChange={vi.fn()}
        folder={currentFolder}
        selectedFolder={currentFolder.path}
        onSelectFolder={vi.fn()}
      />,
    );

    const folderRow = await screen.findByTestId('move-target-row-/projects');
    const folderRowClasses = folderRow.className;
    expect(folderRow).toHaveClass('min-h-10', 'hover:bg-gray-100');
    expect(within(folderRow).getByRole('button', { name: 'projects' })).toContainElement(
      within(folderRow).getByRole('button', { name: 'projects' }).querySelector('svg'),
    );
    expect(screen.getByRole('button', { name: 'projectsを展開する' })).toHaveClass(
      'focus-visible:ring-2',
    );

    folderView.unmount();

    renderDialog(<MoveBookmarkDialog open onOpenChange={vi.fn()} bookmark={bookmark} />);
    const bookmarkRow = await screen.findByTestId('move-target-row-/projects');
    expect(bookmarkRow.className).toBe(folderRowClasses);
    expect(within(bookmarkRow).getByRole('button', { name: 'projects' })).toHaveClass(
      'focus-visible:ring-2',
    );
  });

  it('行全体の選択状態を切り替え、トップ階層のラベルと移動不可条件を維持する', async () => {
    const user = userEvent.setup();
    const folderView = renderDialog(
      <MoveFolderDialog
        open
        onOpenChange={vi.fn()}
        folder={currentFolder}
        selectedFolder={currentFolder.path}
        onSelectFolder={vi.fn()}
      />,
    );

    const rootRow = screen.getByTestId('move-target-row-top');
    expect(within(rootRow).getByRole('button', { name: 'ルート' })).toBeInTheDocument();
    expect(rootRow).toHaveAttribute('data-selected', 'true');
    expect(screen.getByRole('button', { name: '移動' })).toBeDisabled();

    await user.click(await screen.findByRole('button', { name: 'archive' }));
    expect(screen.getByTestId('move-target-row-/archive')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByRole('button', { name: '移動' })).toBeEnabled();

    folderView.unmount();

    renderDialog(<MoveBookmarkDialog open onOpenChange={vi.fn()} bookmark={bookmark} />);
    const uncategorizedRow = screen.getByTestId('move-target-row-top');
    expect(within(uncategorizedRow).getByRole('button', { name: '未分類' })).toBeInTheDocument();
    expect(uncategorizedRow).toHaveAttribute('data-selected', 'true');
    expect(screen.getByRole('button', { name: '移動' })).toBeDisabled();
  });

  it('フォルダ移動では自分自身と子孫を除外し、共通の検索・祖先表示を使う', async () => {
    const user = userEvent.setup();
    renderDialog(
      <MoveFolderDialog
        open
        onOpenChange={vi.fn()}
        folder={currentFolder}
        selectedFolder={currentFolder.path}
        onSelectFolder={vi.fn()}
      />,
    );

    await screen.findByRole('button', { name: 'projects' });
    expect(screen.queryByRole('button', { name: 'current' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'current-child' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'frontend' })).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('フォルダを検索...'), 'frontend');

    expect(screen.getByRole('button', { name: 'projects' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'frontend' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'archive' })).not.toBeInTheDocument();
    expect(screen.getByTestId('move-target-row-/projects/frontend')).toHaveStyle({
      paddingLeft: '24px',
    });
  });

  it('両ダイアログで同じ開閉操作を使う', async () => {
    const user = userEvent.setup();
    const view = renderDialog(
      <MoveBookmarkDialog open onOpenChange={vi.fn()} bookmark={bookmark} />,
    );

    const expand = await screen.findByRole('button', { name: 'projectsを展開する' });
    expand.focus();
    expect(expand).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'frontend' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'projectsを折りたたむ' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    view.unmount();
    renderDialog(
      <MoveFolderDialog
        open
        onOpenChange={vi.fn()}
        folder={currentFolder}
        selectedFolder={currentFolder.path}
        onSelectFolder={vi.fn()}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'projectsを展開する' }));
    expect(screen.getByRole('button', { name: 'frontend' })).toBeInTheDocument();
  });

  it('操作可能な親行だけに展開ボタンを表示し、それ以外は同幅の余白を保つ', async () => {
    const user = userEvent.setup();
    renderDialog(<MoveBookmarkDialog open onOpenChange={vi.fn()} bookmark={bookmark} />);

    const parentRow = await screen.findByTestId('move-target-row-/projects');
    expect(within(parentRow).getAllByRole('button')).toHaveLength(2);
    expect(within(parentRow).getByRole('button', { name: 'projectsを展開する' })).toBeEnabled();

    expectRowWithoutExpandButton(screen.getByTestId('move-target-row-top'));
    expectRowWithoutExpandButton(screen.getByTestId('move-target-row-/archive'));

    await user.type(screen.getByPlaceholderText('フォルダを検索...'), 'frontend');

    expectRowWithoutExpandButton(screen.getByTestId('move-target-row-/projects'));
    expectRowWithoutExpandButton(screen.getByTestId('move-target-row-/projects/frontend'));
    expect(
      screen.queryByRole('button', { name: /を(?:展開する|折りたたむ)$/ }),
    ).not.toBeInTheDocument();
  });
});

function expectRowWithoutExpandButton(row: HTMLElement) {
  expect(within(row).getAllByRole('button')).toHaveLength(1);
  expect(row.querySelector('span[aria-hidden="true"]')).toHaveClass('h-10', 'w-6', 'shrink-0');
}

function renderDialog(element: ReactElement) {
  server.use(http.get('/api/folders', () => HttpResponse.json(folders)));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

function makeFolder(id: string, path: string, parentPath: string | null): Folder {
  return {
    id,
    userId: 'test-user',
    name: id,
    path,
    parentPath,
    position: 0,
    deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}
