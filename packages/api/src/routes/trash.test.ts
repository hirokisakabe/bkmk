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
    // 既存アイテムの position シフト + 復元 update
    vi.mocked(db.update).mockReturnValue(mockQueryChain([]) as never);

    const res = await app.request('/api/trash/bk-1/restore', { method: 'POST' });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it('親フォルダが存在する場合、元のパスに復元する', async () => {
    const deletedChildFolder = {
      id: 'child-folder-1',
      userId: TEST_USER.id,
      name: '子フォルダ',
      path: '/親フォルダ/子フォルダ',
      parentPath: '/親フォルダ',
      position: 0,
      deletedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    // フォルダ検索 → 見つかる
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([deletedChildFolder]) as never);
    // ブックマーク検索 → 見つからない
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([]) as never);
    // 親フォルダ確認 → 存在する
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([{ id: 'parent-folder-1' }]) as never);
    // position シフト
    vi.mocked(db.update).mockReturnValue(mockQueryChain([]) as never);
    // transaction: 復元時に正しいパスが使われることを検証
    const setArgs: unknown[] = [];
    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      const tx = {
        update: () => {
          const chain = {
            set: (values: unknown) => {
              setArgs.push(values);
              return mockQueryChain([]);
            },
          };
          return chain;
        },
      };
      return fn(tx as never);
    });

    const res = await app.request('/api/trash/child-folder-1/restore', { method: 'POST' });
    expect(res.status).toBe(200);

    // 最初の set() 呼び出し（自身の復元）で元のパスが保持されることを確認
    expect(setArgs[0]).toEqual(
      expect.objectContaining({
        path: '/親フォルダ/子フォルダ',
        parentPath: '/親フォルダ',
        deletedAt: null,
      }),
    );
  });

  it('親フォルダが削除済みの場合、ルートに復元する', async () => {
    const deletedChildFolder = {
      id: 'child-folder-2',
      userId: TEST_USER.id,
      name: '子フォルダ',
      path: '/親フォルダ/子フォルダ',
      parentPath: '/親フォルダ',
      position: 0,
      deletedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    // フォルダ検索 → 見つかる
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([deletedChildFolder]) as never);
    // ブックマーク検索 → 見つからない
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([]) as never);
    // 親フォルダ確認 → 存在しない
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([]) as never);
    // position シフト
    vi.mocked(db.update).mockReturnValue(mockQueryChain([]) as never);
    // transaction
    const setArgs: unknown[] = [];
    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      const tx = {
        update: () => {
          const chain = {
            set: (values: unknown) => {
              setArgs.push(values);
              return mockQueryChain([]);
            },
          };
          return chain;
        },
      };
      return fn(tx as never);
    });

    const res = await app.request('/api/trash/child-folder-2/restore', { method: 'POST' });
    expect(res.status).toBe(200);

    // 親フォルダが存在しない場合、ルートに復元される
    expect(setArgs[0]).toEqual(
      expect.objectContaining({
        path: '/子フォルダ',
        parentPath: null,
        deletedAt: null,
      }),
    );
  });

  it('ルート直下のフォルダを復元する', async () => {
    // フォルダ検索 → 見つかる
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([mockDeletedFolder]) as never);
    // ブックマーク検索 → 見つからない
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([]) as never);
    // parentPath が null なので親フォルダ確認はスキップ
    // position シフト
    vi.mocked(db.update).mockReturnValue(mockQueryChain([]) as never);
    // transaction
    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      const tx = {
        update: () => mockQueryChain([]),
      };
      return fn(tx as never);
    });

    const res = await app.request('/api/trash/folder-1/restore', { method: 'POST' });
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
