import { screen, waitFor } from '@testing-library/react';
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
});
