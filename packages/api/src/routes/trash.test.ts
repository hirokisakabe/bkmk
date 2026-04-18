import { describe, expect, it, vi } from 'vitest';

import { createTestApp, mockQueryChain, TEST_USER } from '../test/helpers.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

import { db } from '../db/index.js';
import { trashRoute } from './trash.js';

const app = createTestApp('/api/trash', trashRoute);

const mockDeletedFolder = {
  id: 'folder-1',
  userId: TEST_USER.id,
  name: 'work',
  path: '/work',
  parentPath: null,
  position: 0,
  deletedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};

const mockDeletedBookmark = {
  id: 'bk-1',
  userId: TEST_USER.id,
  url: 'https://example.com',
  title: 'Example',
  description: null,
  imageUrl: null,
  faviconUrl: null,
  folderPath: null,
  position: 0,
  deletedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('GET /api/trash', () => {
  it('ゴミ箱のアイテムを返す', async () => {
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([mockDeletedFolder]) as never);
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([mockDeletedBookmark]) as never);

    const res = await app.request('/api/trash');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      folders: [mockDeletedFolder],
      bookmarks: [mockDeletedBookmark],
    });
  });

  it('ゴミ箱が空の場合は空配列を返す', async () => {
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([]) as never);
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([]) as never);

    const res = await app.request('/api/trash');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ folders: [], bookmarks: [] });
  });
});

describe('POST /api/trash/:id/restore', () => {
  it('ブックマークを復元する', async () => {
    // フォルダ検索 → 見つからない, ブックマーク検索 → 見つかる
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([]) as never);
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([mockDeletedBookmark]) as never);
    // 復元先フォルダ確認 (folderPath が null なのでスキップ)
    // maxPos
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([{ max: -1 }]) as never);
    // update
    vi.mocked(db.update).mockReturnValue(mockQueryChain([]) as never);

    const res = await app.request('/api/trash/bk-1/restore', { method: 'POST' });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it('存在しないアイテムで404を返す', async () => {
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([]) as never);
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([]) as never);

    const res = await app.request('/api/trash/nonexistent/restore', { method: 'POST' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/trash/:id', () => {
  it('ブックマークを完全削除する', async () => {
    // フォルダ検索 → 見つからない, ブックマーク検索 → 見つかる
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([]) as never);
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([mockDeletedBookmark]) as never);
    // delete
    vi.mocked(db.delete).mockReturnValue(mockQueryChain([]) as never);

    const res = await app.request('/api/trash/bk-1', { method: 'DELETE' });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it('フォルダを完全削除する（配下含む）', async () => {
    // フォルダ検索 → 見つかる
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([mockDeletedFolder]) as never);
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([]) as never);
    // transaction
    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      const tx = {
        delete: () => mockQueryChain([]),
      };
      return fn(tx as never);
    });

    const res = await app.request('/api/trash/folder-1', { method: 'DELETE' });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it('存在しないアイテムで404を返す', async () => {
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([]) as never);
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([]) as never);

    const res = await app.request('/api/trash/nonexistent', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/trash', () => {
  it('ゴミ箱を空にする', async () => {
    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      const tx = {
        delete: () => mockQueryChain([]),
      };
      return fn(tx as never);
    });

    const res = await app.request('/api/trash', { method: 'DELETE' });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ success: true });
  });
});
