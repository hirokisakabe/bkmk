import { describe, expect, it, vi } from 'vitest';

import { createTestApp, mockQueryChain, TEST_USER } from '../test/helpers.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { db } from '../db/index.js';
import { searchRoute } from './search.js';

const app = createTestApp('/api/search', searchRoute);

const mockSearchResult = {
  id: 'bk-1',
  userId: TEST_USER.id,
  url: 'https://example.com',
  title: 'Example',
  description: 'An example site',
  imageUrl: null,
  faviconUrl: null,
  folderPath: '/work',
  position: 0,
  deletedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  folder: {
    id: 'folder-1',
    name: 'work',
    path: '/work',
    parentPath: null,
  },
};

describe('GET /api/search', () => {
  it('検索結果を返す', async () => {
    vi.mocked(db.select).mockReturnValue(mockQueryChain([mockSearchResult]) as never);

    const res = await app.request('/api/search?q=example');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual([mockSearchResult]);
  });

  it('検索クエリが空の場合はバリデーションエラーを返す', async () => {
    const res = await app.request('/api/search?q=');
    expect(res.status).toBe(400);
  });

  it('検索クエリがない場合はバリデーションエラーを返す', async () => {
    const res = await app.request('/api/search');
    expect(res.status).toBe(400);
  });

  it('空の検索結果を返す', async () => {
    vi.mocked(db.select).mockReturnValue(mockQueryChain([]) as never);

    const res = await app.request('/api/search?q=nonexistent');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual([]);
  });
});
