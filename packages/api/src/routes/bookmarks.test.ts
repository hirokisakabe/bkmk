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
    vi.mocked(db.select)
      .mockReturnValueOnce(mockQueryChain([{ id: 'folder-1' }]) as never) // フォルダ存在確認
      .mockReturnValueOnce(mockQueryChain([mockBookmark]) as never); // ブックマーク取得

    const res = await app.request('/api/bookmarks?folder=/work');
    expect(res.status).toBe(200);
  });

  it('存在しないフォルダを指定すると 404 を返す', async () => {
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([]) as never); // フォルダ存在確認 → 空

    const res = await app.request('/api/bookmarks?folder=/nonexistent');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body).toEqual({ error: 'Folder not found' });
  });

  it('deep=true でサブフォルダも含める', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(mockQueryChain([{ id: 'folder-1' }]) as never) // フォルダ存在確認
      .mockReturnValueOnce(mockQueryChain([mockBookmark]) as never); // ブックマーク取得

    const res = await app.request('/api/bookmarks?folder=/work&deep=true');
    expect(res.status).toBe(200);
  });

  it('limit 指定時にページネーション形式で返す', async () => {
    vi.mocked(db.select).mockReturnValue(mockQueryChain([mockBookmark]) as never);

    const res = await app.request('/api/bookmarks?limit=10');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('nextCursor');
    expect(body.data).toEqual([mockBookmark]);
    expect(body.nextCursor).toBeNull();
  });

  it('limit 指定時に次ページがある場合 nextCursor を返す', async () => {
    const items = Array.from({ length: 3 }, (_, i) => ({
      ...mockBookmark,
      id: `bk-${i}`,
      position: i,
    }));
    vi.mocked(db.select).mockReturnValue(mockQueryChain(items) as never);

    const res = await app.request('/api/bookmarks?limit=2');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.nextCursor).not.toBeNull();
  });

  it('grouped=true はgrouped queryの結果をpagination形式で返す', async () => {
    const folderRows = [
      { path: '/later', parentPath: null, position: 1 },
      { path: '/first/child', parentPath: '/first', position: 0 },
      { path: '/first', parentPath: null, position: 0 },
    ];
    const items = [
      { ...mockBookmark, id: 'root', folderPath: null, position: 0 },
      { ...mockBookmark, id: 'first-1', folderPath: '/first', position: 0 },
      { ...mockBookmark, id: 'first-2', folderPath: '/first', position: 1 },
      { ...mockBookmark, id: 'child', folderPath: '/first/child', position: 0 },
      { ...mockBookmark, id: 'later', folderPath: '/later', position: 0 },
    ];
    vi.mocked(db.select)
      .mockReturnValueOnce(mockQueryChain(folderRows) as never)
      .mockReturnValueOnce(mockQueryChain(items) as never);

    const res = await app.request('/api/bookmarks?deep=true&grouped=true&limit=10');
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data.map((bookmark: { id: string }) => bookmark.id)).toEqual([
      'root',
      'first-1',
      'first-2',
      'child',
      'later',
    ]);
    expect(body.nextCursor).toBeNull();
  });

  it('limit 未指定時は従来どおり配列を返す', async () => {
    vi.mocked(db.select).mockReturnValue(mockQueryChain([mockBookmark]) as never);

    const res = await app.request('/api/bookmarks');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
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

  it('URL重複時にフォルダパスを含むエラーメッセージを返す', async () => {
    // ソフトデリート済みレコードの物理削除
    vi.mocked(db.delete).mockReturnValueOnce(mockQueryChain([]) as never);
    // 既存アイテムの position シフト
    vi.mocked(db.update).mockReturnValueOnce(mockQueryChain([]) as never);
    // insert → unique violation
    const uniqueError = new Error('duplicate key');
    (uniqueError as unknown as { code: string }).code = '23505';
    vi.mocked(db.insert).mockReturnValue({
      values: () => ({
        returning: () => Promise.reject(uniqueError),
      }),
    } as never);
    // 既存ブックマークの検索
    vi.mocked(db.select).mockReturnValue(
      mockQueryChain([{ folderPath: '/tech/frontend' }]) as never,
    );

    const res = await app.request('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('このURLはすでに「/tech/frontend」に登録されています');
  });

  it('URL重複時にfolderPathがnullの場合「未分類」と表示する', async () => {
    // ソフトデリート済みレコードの物理削除
    vi.mocked(db.delete).mockReturnValueOnce(mockQueryChain([]) as never);
    // 既存アイテムの position シフト
    vi.mocked(db.update).mockReturnValueOnce(mockQueryChain([]) as never);
    // insert → unique violation
    const uniqueError = new Error('duplicate key');
    (uniqueError as unknown as { code: string }).code = '23505';
    vi.mocked(db.insert).mockReturnValue({
      values: () => ({
        returning: () => Promise.reject(uniqueError),
      }),
    } as never);
    // 既存ブックマークの検索（未分類）
    vi.mocked(db.select).mockReturnValue(mockQueryChain([{ folderPath: null }]) as never);

    const res = await app.request('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('このURLはすでに「未分類」に登録されています');
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
