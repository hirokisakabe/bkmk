import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { mockBookmarks } from '../test/handlers';
import { renderWithProviders } from '../test/render';
import { server } from '../test/server';
import type { Bookmark } from '../types';

describe('bookmark DnD handle', () => {
  it('1件だけのフォルダでもカード全体ではなくフォルダ移動handleを表示する', async () => {
    renderWithProviders({ initialUrl: '/?folder=%2Fwork' });

    const card = await screen.findByTestId(`bookmark-card-${mockBookmarks[2].id}`);
    const handle = screen.getByRole('button', { name: 'フォルダ移動' });
    const draggableNode = card.parentElement?.parentElement;

    expect(handle).toHaveAttribute('aria-describedby');
    expect(draggableNode).not.toHaveAttribute('role');
    expect(draggableNode).not.toHaveAttribute('tabindex');
    expect(draggableNode).not.toHaveAttribute('aria-describedby');
  });

  it('すべて表示ではgroup内件数に応じた用途のhandleを表示する', async () => {
    renderWithProviders({ initialUrl: '/' });

    expect(await screen.findAllByRole('button', { name: '並び替え・フォルダ移動' })).toHaveLength(
      2,
    );
    expect(screen.getAllByRole('button', { name: 'フォルダ移動' })).toHaveLength(1);
    expect(screen.getByTestId(`bookmark-drag-handle-${mockBookmarks[2].id}`)).toHaveAttribute(
      'aria-label',
      'フォルダ移動',
    );
    expect(screen.getByTestId(`bookmark-drag-handle-${mockBookmarks[0].id}`)).toHaveAttribute(
      'aria-label',
      '並び替え・フォルダ移動',
    );
  });

  it('2件以上の並び替え可能なフォルダでは用途を示す共用handleを表示する', async () => {
    const secondWorkBookmark: Bookmark = {
      ...mockBookmarks[2],
      id: 'bk-work-2',
      url: 'https://work-2.example.com',
      title: 'Second Work Site',
      position: 1,
    };
    server.use(
      http.get('/api/bookmarks', () => HttpResponse.json([mockBookmarks[2], secondWorkBookmark])),
    );

    renderWithProviders({ initialUrl: '/?folder=%2Fwork' });

    expect(await screen.findAllByRole('button', { name: '並び替え・フォルダ移動' })).toHaveLength(
      2,
    );
    expect(screen.queryByRole('button', { name: 'フォルダ移動' })).not.toBeInTheDocument();
  });
});
