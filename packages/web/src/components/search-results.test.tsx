import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { mockBookmarks } from '../test/handlers';
import { renderWithProviders } from '../test/render';
import { server } from '../test/server';
import type { SearchResult } from '../types';

const folderResult: SearchResult = {
  ...mockBookmarks[2],
  description: 'フォルダに保存された検索結果の説明',
  imageUrl: 'https://work.example.com/ogp.png',
  folder: {
    id: 'folder-project',
    name: 'project',
    path: '/work/project',
    parentPath: '/work',
  },
};

const uncategorizedResult: SearchResult = {
  ...mockBookmarks[0],
  folder: null,
};

describe('SearchResults', () => {
  it('通常一覧と同じカードグリッドに表示要素と保存先を表示し、一覧操作は持たない', async () => {
    server.use(
      http.get('/api/search', () =>
        HttpResponse.json([folderResult, uncategorizedResult] satisfies SearchResult[]),
      ),
    );

    renderWithProviders({ initialUrl: '/?q=bookmark' });

    const folderCard = await screen.findByTestId(`search-result-card-${folderResult.id}`);
    const uncategorizedCard = screen.getByTestId(`search-result-card-${uncategorizedResult.id}`);
    const grid = screen.getByTestId('search-results-grid');

    expect(grid).toHaveClass('grid', 'grid-cols-2', 'sm:grid-cols-3', 'lg:grid-cols-6');
    expect(folderCard.parentElement).toBe(grid);
    expect(folderCard).toHaveAttribute('href', folderResult.url);
    expect(folderCard).toHaveAttribute('target', '_blank');
    expect(within(folderCard).getByText(folderResult.title!)).toBeInTheDocument();
    expect(within(folderCard).getByText(folderResult.description!)).toBeInTheDocument();
    expect(within(folderCard).getByText(folderResult.url)).toBeInTheDocument();
    expect(within(folderCard).getByText('/work/project')).toBeInTheDocument();
    expect(folderCard.querySelector(`img[src="${folderResult.imageUrl}"]`)).toBeInTheDocument();
    expect(folderCard.querySelector(`img[src="${folderResult.faviconUrl}"]`)).toBeInTheDocument();

    expect(within(uncategorizedCard).getByText('未分類')).toBeInTheDocument();
    expect(within(uncategorizedCard).getByTestId('bookmark-image-placeholder')).toBeInTheDocument();
    expect(within(grid).queryByRole('button', { name: '削除' })).not.toBeInTheDocument();
    expect(
      within(grid).queryByRole('button', { name: /フォルダ移動|並び替え/ }),
    ).not.toBeInTheDocument();
    expect(within(grid).queryByText('移動')).not.toBeInTheDocument();
  });

  it('検索中は通常一覧と同じ列数のグリッドにカード型スケルトンを表示する', async () => {
    let finishSearch!: () => void;
    server.use(
      http.get('/api/search', async () => {
        await new Promise<void>((resolve) => {
          finishSearch = resolve;
        });
        return HttpResponse.json([]);
      }),
    );

    renderWithProviders({ initialUrl: '/?q=loading' });

    const grid = await screen.findByTestId('search-results-grid');
    const skeletons = within(grid).getAllByTestId('search-result-loading-skeleton');
    expect(grid).toHaveClass('grid', 'grid-cols-2', 'sm:grid-cols-3', 'lg:grid-cols-6');
    expect(skeletons).toHaveLength(6);
    expect(skeletons[0].parentElement).toBe(grid);

    finishSearch();
    expect(await screen.findByText('検索結果はありません')).toBeInTheDocument();
  });
});
