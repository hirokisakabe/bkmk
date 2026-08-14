import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../test/render';
import { server } from '../test/server';

describe('TrashPage', () => {
  it('ゴミ箱のアイテムが表示される', async () => {
    renderWithProviders({ initialUrl: '/trash' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'ゴミ箱' })).toBeInTheDocument();
    });

    // フォルダ名とブックマークタイトルが表示される
    await waitFor(() => {
      expect(screen.getByText('work')).toBeInTheDocument();
    });
    expect(screen.getByText('Example Site')).toBeInTheDocument();
  });

  it('復元ボタンが表示される', async () => {
    renderWithProviders({ initialUrl: '/trash' });

    await waitFor(() => {
      const restoreButtons = screen.getAllByText('復元');
      expect(restoreButtons.length).toBeGreaterThan(0);
    });
  });

  it('完全削除ボタンが表示される', async () => {
    renderWithProviders({ initialUrl: '/trash' });

    await waitFor(() => {
      const deleteButtons = screen.getAllByText('完全削除');
      expect(deleteButtons.length).toBeGreaterThan(0);
    });
  });

  it('ゴミ箱を空にするボタンが表示される', async () => {
    renderWithProviders({ initialUrl: '/trash' });

    await waitFor(() => {
      expect(screen.getByText('ゴミ箱を空にする')).toBeInTheDocument();
    });
  });

  it('ゴミ箱が空の場合はメッセージが表示される', async () => {
    server.use(
      http.get('/api/trash', () => {
        return HttpResponse.json({ folders: [], bookmarks: [] });
      }),
    );

    renderWithProviders({ initialUrl: '/trash' });

    await waitFor(() => {
      expect(screen.getByText('ゴミ箱にアイテムはありません')).toBeInTheDocument();
    });
  });

  it('長いフォルダ名を操作ボタンの手前で省略し、pointer と focus で全文を表示する', async () => {
    const longFolderName = '削除済みのとても長いフォルダ名プロジェクトアルファベータ';
    server.use(
      http.get('/api/trash', () =>
        HttpResponse.json({
          folders: [
            {
              id: 'long-folder',
              userId: 'test-user',
              name: longFolderName,
              path: `/${longFolderName}`,
              parentPath: null,
              position: 0,
              deletedAt: '2024-06-01T00:00:00.000Z',
              createdAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          bookmarks: [],
        }),
      ),
    );
    renderWithProviders({ initialUrl: '/trash' });

    const name = await screen.findByText(longFolderName);
    const card = name.closest('.border-gray-200') as HTMLElement;
    expect(name).toHaveClass('min-w-0', 'flex-1', 'truncate');
    expect(within(card).getByRole('button', { name: '復元' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: '完全削除' })).toBeInTheDocument();
    markAsOverflowing(name);

    fireEvent.pointerEnter(name);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(longFolderName);
    fireEvent.pointerLeave(name);

    name.focus();
    expect(name).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(longFolderName);
    expect(name).not.toHaveAttribute('title');
  });
});

function markAsOverflowing(element: HTMLElement) {
  Object.defineProperties(element, {
    scrollWidth: { configurable: true, value: 500 },
    clientWidth: { configurable: true, value: 120 },
  });
  fireEvent(window, new Event('resize'));
}
