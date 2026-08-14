import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../test/server';
import type { Bookmark, Folder } from '../types';
import {
  CreateFolderDialog,
  MoveBookmarkDialog,
  MoveFolderDialog,
  RenameFolderDialog,
} from './folder-dialogs';

const longFolderName = '空白 を含む とても 長い 移動先 フォルダ名 プロジェクト';
const folders: Folder[] = [
  makeFolder('current', '/current', null),
  makeFolder('current-child', '/current/child', '/current'),
  makeFolder('projects', '/projects', null),
  makeFolder('frontend', '/projects/frontend', '/projects'),
  makeFolder('archive', '/archive', null),
  {
    ...makeFolder('long-folder', `/${longFolderName}`, null),
    name: longFolderName,
  },
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

describe('フォルダ名の入力検証', () => {
  describe('作成ダイアログ', () => {
    it('255文字は送信し、256文字は送信前に拒否する', async () => {
      const requests: string[] = [];
      mockCreateFolderRequest(requests);
      const user = userEvent.setup();
      renderDialog(<CreateFolderDialog open onOpenChange={vi.fn()} parentPath={null} />);

      const input = screen.getByRole('textbox', { name: 'フォルダ名' });
      const maxLengthName = 'あ'.repeat(255);
      fireEvent.change(input, { target: { value: maxLengthName } });
      await user.click(screen.getByRole('button', { name: '作成' }));

      await waitFor(() => expect(requests).toEqual([`/${maxLengthName}`]));

      fireEvent.change(input, { target: { value: 'あ'.repeat(256) } });
      expect(screen.getByRole('button', { name: '作成' })).toBeDisabled();
      expectLocalError(input, 'フォルダ名は255文字以内で入力してください。');
      fireEvent.submit(input.closest('form')!);
      expect(requests).toHaveLength(1);
    });

    it.each([' folder', 'folder ', '   '])(
      '前後空白を含む「%s」を送信前に拒否する',
      (invalidName) => {
        const requests: string[] = [];
        mockCreateFolderRequest(requests);
        renderDialog(<CreateFolderDialog open onOpenChange={vi.fn()} parentPath={null} />);

        const input = screen.getByRole('textbox', { name: 'フォルダ名' });
        fireEvent.change(input, { target: { value: invalidName } });

        expectLocalError(input, 'フォルダ名の先頭と末尾の空白を削除してください。');
        fireEvent.submit(input.closest('form')!);
        expect(requests).toHaveLength(0);
      },
    );

    it('不許可文字を送信前に拒否し、使用可能な文字を案内する', () => {
      const requests: string[] = [];
      mockCreateFolderRequest(requests);
      renderDialog(<CreateFolderDialog open onOpenChange={vi.fn()} parentPath={null} />);

      const input = screen.getByRole('textbox', { name: 'フォルダ名' });
      fireEvent.change(input, { target: { value: 'work/private' } });

      expectLocalError(input, /使用できる文字は、英数字/);
      fireEvent.submit(input.closest('form')!);
      expect(requests).toHaveLength(0);
    });

    it('空白・絵文字・日本語を含む許可文字の名前をそのまま送信する', async () => {
      const requests: string[] = [];
      mockCreateFolderRequest(requests);
      const user = userEvent.setup();
      renderDialog(<CreateFolderDialog open onOpenChange={vi.fn()} parentPath={null} />);

      const allowedName = '日本語 📝 & café-1_2.3';
      fireEvent.change(screen.getByRole('textbox', { name: 'フォルダ名' }), {
        target: { value: allowedName },
      });
      await user.click(screen.getByRole('button', { name: '作成' }));

      await waitFor(() => expect(requests).toEqual([`/${allowedName}`]));
    });

    it('API エラー後に入力を変更すると古いエラーを解除する', async () => {
      mockFolderRequestError('post');
      const user = userEvent.setup();
      renderDialog(<CreateFolderDialog open onOpenChange={vi.fn()} parentPath={null} />);

      const input = screen.getByRole('textbox', { name: 'フォルダ名' });
      await user.type(input, 'duplicate');
      await user.click(screen.getByRole('button', { name: '作成' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('同名フォルダがあります');

      await user.type(input, '-fixed');

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(input).not.toHaveAttribute('aria-invalid');
      expect(input).not.toHaveAttribute('aria-describedby');
    });

    it('送信中に入力が変わっても成功時の完了処理を維持する', async () => {
      const responseGate = createDeferred<void>();
      const requestStarted = vi.fn();
      const onOpenChange = vi.fn();
      server.use(
        http.post('/api/folders', async () => {
          requestStarted();
          await responseGate.promise;
          return HttpResponse.json(currentFolder, { status: 201 });
        }),
      );
      const user = userEvent.setup();
      renderDialog(<CreateFolderDialog open onOpenChange={onOpenChange} parentPath={null} />);

      const input = screen.getByRole('textbox', { name: 'フォルダ名' });
      await user.type(input, 'project');
      await user.click(screen.getByRole('button', { name: '作成' }));
      await waitFor(() => expect(requestStarted).toHaveBeenCalledOnce());
      fireEvent.change(input, { target: { value: 'project-updated' } });
      responseGate.resolve();

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });
  });

  describe('名前変更ダイアログ', () => {
    it('255文字は送信し、256文字は送信前に拒否する', async () => {
      const requests: string[] = [];
      mockRenameFolderRequest(requests);
      const user = userEvent.setup();
      renderRenameDialog();

      const input = screen.getByRole('textbox', { name: 'フォルダ名' });
      const maxLengthName = 'あ'.repeat(255);
      fireEvent.change(input, { target: { value: maxLengthName } });
      await user.click(screen.getByRole('button', { name: '変更' }));

      await waitFor(() => expect(requests).toEqual([maxLengthName]));

      fireEvent.change(input, { target: { value: 'あ'.repeat(256) } });
      expect(screen.getByRole('button', { name: '変更' })).toBeDisabled();
      expectLocalError(input, 'フォルダ名は255文字以内で入力してください。');
      fireEvent.submit(input.closest('form')!);
      expect(requests).toHaveLength(1);
    });

    it.each([' folder', 'folder ', '   '])(
      '前後空白を含む「%s」を送信前に拒否する',
      (invalidName) => {
        const requests: string[] = [];
        mockRenameFolderRequest(requests);
        renderRenameDialog();

        const input = screen.getByRole('textbox', { name: 'フォルダ名' });
        fireEvent.change(input, { target: { value: invalidName } });

        expectLocalError(input, 'フォルダ名の先頭と末尾の空白を削除してください。');
        fireEvent.submit(input.closest('form')!);
        expect(requests).toHaveLength(0);
      },
    );

    it('不許可文字を送信前に拒否し、使用可能な文字を案内する', () => {
      const requests: string[] = [];
      mockRenameFolderRequest(requests);
      renderRenameDialog();

      const input = screen.getByRole('textbox', { name: 'フォルダ名' });
      fireEvent.change(input, { target: { value: 'work/private' } });

      expectLocalError(input, /使用できる文字は、英数字/);
      fireEvent.submit(input.closest('form')!);
      expect(requests).toHaveLength(0);
    });

    it('空白・絵文字・日本語を含む許可文字の名前をそのまま送信する', async () => {
      const requests: string[] = [];
      mockRenameFolderRequest(requests);
      const user = userEvent.setup();
      renderRenameDialog();

      const allowedName = '日本語 📝 & café-1_2.3';
      fireEvent.change(screen.getByRole('textbox', { name: 'フォルダ名' }), {
        target: { value: allowedName },
      });
      await user.click(screen.getByRole('button', { name: '変更' }));

      await waitFor(() => expect(requests).toEqual([allowedName]));
    });

    it('API エラー後に入力を変更すると古いエラーを解除する', async () => {
      mockFolderRequestError('patch');
      const user = userEvent.setup();
      renderRenameDialog();

      const input = screen.getByRole('textbox', { name: 'フォルダ名' });
      await user.clear(input);
      await user.type(input, 'duplicate');
      await user.click(screen.getByRole('button', { name: '変更' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('同名フォルダがあります');

      await user.type(input, '-fixed');

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(input).not.toHaveAttribute('aria-invalid');
      expect(input).not.toHaveAttribute('aria-describedby');
    });

    it('送信中に入力が変わっても成功時の完了処理を維持する', async () => {
      const responseGate = createDeferred<void>();
      const requestStarted = vi.fn();
      const onOpenChange = vi.fn();
      server.use(
        http.patch('/api/folders/:id', async () => {
          requestStarted();
          await responseGate.promise;
          return HttpResponse.json({ ...currentFolder, name: 'renamed', path: '/renamed' });
        }),
      );
      const user = userEvent.setup();
      renderRenameDialog(onOpenChange);

      const input = screen.getByRole('textbox', { name: 'フォルダ名' });
      await user.clear(input);
      await user.type(input, 'renamed');
      await user.click(screen.getByRole('button', { name: '変更' }));
      await waitFor(() => expect(requestStarted).toHaveBeenCalledOnce());
      fireEvent.change(input, { target: { value: 'renamed-again' } });
      responseGate.resolve();

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });
  });
});

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

  it('長い移動先名を省略し、pointer と keyboard focus で全文を表示する', async () => {
    renderDialog(<MoveBookmarkDialog open onOpenChange={vi.fn()} bookmark={bookmark} />);

    const row = await screen.findByTestId(`move-target-row-/${longFolderName}`);
    const nameButton = within(row).getByRole('button', { name: longFolderName });
    const name = within(nameButton).getByText(longFolderName);
    expect(nameButton).toHaveClass('min-w-0', 'flex-1');
    expect(name).toHaveClass('min-w-0', 'flex-1', 'truncate');
    markAsOverflowing(name);

    fireEvent.pointerEnter(nameButton);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(longFolderName);
    fireEvent.pointerLeave(nameButton);

    nameButton.focus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(longFolderName);
    expect(nameButton).not.toHaveAttribute('title');
  });
});

function expectRowWithoutExpandButton(row: HTMLElement) {
  expect(within(row).getAllByRole('button')).toHaveLength(1);
  expect(row.querySelector('span[aria-hidden="true"]')).toHaveClass('h-10', 'w-6', 'shrink-0');
}

function markAsOverflowing(element: HTMLElement) {
  Object.defineProperties(element, {
    scrollWidth: { configurable: true, value: 320 },
    clientWidth: { configurable: true, value: 100 },
  });
  fireEvent(window, new Event('resize'));
}

function expectLocalError(input: HTMLElement, message: string | RegExp) {
  expect(input).toHaveAttribute('aria-invalid', 'true');
  const alert = screen.getByRole('alert');
  if (typeof message === 'string') {
    expect(alert).toHaveTextContent(message);
  } else {
    expect(alert).toHaveTextContent(message);
  }
  expect(input).toHaveAttribute('aria-describedby', alert.id);
}

function mockCreateFolderRequest(requests: string[]) {
  server.use(
    http.post('/api/folders', async ({ request }) => {
      const { path } = (await request.json()) as { path: string };
      requests.push(path);
      return HttpResponse.json({ ...currentFolder, name: path.slice(1), path }, { status: 201 });
    }),
  );
}

function mockRenameFolderRequest(requests: string[]) {
  server.use(
    http.patch('/api/folders/:id', async ({ request }) => {
      const { name } = (await request.json()) as { name: string };
      requests.push(name);
      return HttpResponse.json({ ...currentFolder, name, path: `/${name}` });
    }),
  );
}

function mockFolderRequestError(method: 'post' | 'patch') {
  const handler = () => HttpResponse.json({ error: '同名フォルダがあります' }, { status: 409 });
  server.use(
    method === 'post'
      ? http.post('/api/folders', handler)
      : http.patch('/api/folders/:id', handler),
  );
}

function renderRenameDialog(onOpenChange = vi.fn()) {
  return renderDialog(
    <RenameFolderDialog
      open
      onOpenChange={onOpenChange}
      folder={currentFolder}
      selectedFolder={currentFolder.path}
      onSelectFolder={vi.fn()}
    />,
  );
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
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
