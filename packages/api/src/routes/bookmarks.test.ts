import { describe, expect, it, vi } from 'vitest';

import { createTestApp, mockQueryChain, TEST_USER } from '../test/helpers.js';

// db モック
vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

// ogp モック
vi.mock('../ogp.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../ogp.js')>();
  return {
    ...original,
    fetchOgpMetadata: vi.fn().mockResolvedValue({
      title: 'Test Title',
      description: 'Test Description',
      imageUrl: 'https://example.com/image.jpg',
      faviconUrl: 'https://example.com/favicon.ico',
    }),
  };
});

import { db } from '../db/index.js';
import { bookmarksRoute } from './bookmarks.js';

const app = createTestApp('/api/bookmarks', bookmarksRoute);

const mockBookmark = {
  id: 'bk-1',
  userId: TEST_USER.id,
  url: 'https://example.com',
  title: 'Example',
  description: 'An example site',
  imageUrl: null,
  faviconUrl: 'https://example.com/favicon.ico',
  folderPath: null,
  position: 0,
  deletedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('GET /api/bookmarks', () => {
  it('ブックマーク一覧を返す', async () => {
    vi.mocked(db.select).mockReturnValue(mockQueryChain([mockBookmark]) as never);

    const res = await app.request('/api/bookmarks');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual([mockBookmark]);
  });

  it('folder パラメータでフィルタできる', async () => {
    vi.mocked(db.select).mockReturnValue(mockQueryChain([mockBookmark]) as never);

    const res = await app.request('/api/bookmarks?folder=/work');
    expect(res.status).toBe(200);
  });

  it('deep=true でサブフォルダも含める', async () => {
    vi.mocked(db.select).mockReturnValue(mockQueryChain([mockBookmark]) as never);

    const res = await app.request('/api/bookmarks?folder=/work&deep=true');
    expect(res.status).toBe(200);
  });
});

describe('POST /api/bookmarks', () => {
  it('ブックマークを作成する', async () => {
    // フォルダ確認不要（folderPath なし）
    // ソフトデリート済みレコードの物理削除
    vi.mocked(db.delete).mockReturnValueOnce(mockQueryChain([]) as never);
    // 既存アイテムの position シフト
    vi.mocked(db.update).mockReturnValueOnce(mockQueryChain([]) as never);
    // insert
    vi.mocked(db.insert).mockReturnValue(mockQueryChain([mockBookmark]) as never);

    const res = await app.request('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual(mockBookmark);
  });

  it('不正なURLでバリデーションエラーを返す', async () => {
    const res = await app.request('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'not-a-url' }),
    });

    expect(res.status).toBe(400);
  });

  it('プライベートIPのURLを拒否する', async () => {
    const res = await app.request('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://192.168.1.1' }),
    });

    expect(res.status).toBe(400);
  });

  it('存在しないフォルダパスで404を返す', async () => {
    // フォルダ検索 → 見つからない
    vi.mocked(db.select).mockReturnValue(mockQueryChain([]) as never);

    const res = await app.request('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com', folderPath: '/nonexistent' }),
    });

    expect(res.status).toBe(404);
  });

  it('ソフトデリート済みの同一URLブックマークを物理削除してから新規作成する', async () => {
    // ソフトデリート済みレコードの物理削除
    vi.mocked(db.delete).mockReturnValueOnce(mockQueryChain([]) as never);
    // 既存アイテムの position シフト
    vi.mocked(db.update).mockReturnValueOnce(mockQueryChain([]) as never);
    // insert
    vi.mocked(db.insert).mockReturnValue(mockQueryChain([mockBookmark]) as never);

    const res = await app.request('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });

    expect(res.status).toBe(201);
    expect(db.delete).toHaveBeenCalled();
  });
});

describe('PATCH /api/bookmarks/:id', () => {
  it('ブックマークを更新する', async () => {
    const updated = { ...mockBookmark, title: 'Updated Title' };
    // select (既存ブックマーク取得)
    vi.mocked(db.select).mockReturnValue(mockQueryChain([mockBookmark]) as never);
    // update
    vi.mocked(db.update).mockReturnValue(mockQueryChain([updated]) as never);

    const res = await app.request('/api/bookmarks/bk-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Title' }),
    });

    expect(res.status).toBe(200);
  });

  it('存在しないブックマークで404を返す', async () => {
    vi.mocked(db.select).mockReturnValue(mockQueryChain([]) as never);

    const res = await app.request('/api/bookmarks/nonexistent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/bookmarks/:id/position', () => {
  it('ブックマークの位置を変更する', async () => {
    const moved = { ...mockBookmark, position: 2 };
    vi.mocked(db.select).mockReturnValue(mockQueryChain([mockBookmark]) as never);
    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      const tx = {
        update: () => mockQueryChain([moved]),
      };
      return fn(tx as never);
    });

    const res = await app.request('/api/bookmarks/bk-1/position', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position: 2 }),
    });

    expect(res.status).toBe(200);
  });

  it('同じ位置の場合はそのまま返す', async () => {
    vi.mocked(db.select).mockReturnValue(mockQueryChain([mockBookmark]) as never);

    const res = await app.request('/api/bookmarks/bk-1/position', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position: 0 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.position).toBe(0);
  });

  it('存在しないブックマークで404を返す', async () => {
    vi.mocked(db.select).mockReturnValue(mockQueryChain([]) as never);

    const res = await app.request('/api/bookmarks/nonexistent/position', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position: 1 }),
    });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/bookmarks/:id', () => {
  it('ブックマークをソフトデリートする', async () => {
    vi.mocked(db.select).mockReturnValue(mockQueryChain([mockBookmark]) as never);
    vi.mocked(db.update).mockReturnValue(mockQueryChain([]) as never);

    const res = await app.request('/api/bookmarks/bk-1', {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it('存在しないブックマークで404を返す', async () => {
    vi.mocked(db.select).mockReturnValue(mockQueryChain([]) as never);

    const res = await app.request('/api/bookmarks/nonexistent', {
      method: 'DELETE',
    });

    expect(res.status).toBe(404);
  });
});
