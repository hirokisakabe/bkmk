import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import { foldersRoute } from './folders.js';

const app = createTestApp('/api/folders', foldersRoute);

beforeEach(() => {
  vi.clearAllMocks();
});

const mockFolder = {
  id: 'folder-1',
  userId: TEST_USER.id,
  name: 'work',
  path: '/work',
  parentPath: null,
  position: 0,
  deletedAt: null,
  createdAt: new Date().toISOString(),
};

describe('GET /api/folders', () => {
  it('フォルダ一覧を返す', async () => {
    vi.mocked(db.select).mockReturnValue(mockQueryChain([mockFolder]) as never);

    const res = await app.request('/api/folders');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual([mockFolder]);
  });

  it('parent パラメータでフィルタできる', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(mockQueryChain([{ id: 'folder-1' }]) as never) // 親フォルダ存在確認
      .mockReturnValueOnce(mockQueryChain([]) as never); // 子フォルダ取得

    const res = await app.request('/api/folders?parent=/work');
    expect(res.status).toBe(200);
  });

  it('存在しない親フォルダを指定すると 404 を返す', async () => {
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([]) as never); // 親フォルダ存在確認 → 空

    const res = await app.request('/api/folders?parent=/nonexistent');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body).toEqual({ error: 'Folder not found' });
  });

  it('all=true で全フォルダを返す', async () => {
    const childFolder = {
      ...mockFolder,
      id: 'folder-2',
      name: 'sub',
      path: '/work/sub',
      parentPath: '/work',
    };
    vi.mocked(db.select).mockReturnValue(mockQueryChain([mockFolder, childFolder]) as never);

    const res = await app.request('/api/folders?all=true');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual([mockFolder, childFolder]);
  });
});

describe('POST /api/folders', () => {
  it('フォルダを作成する', async () => {
    // ソフトデリート済みレコードの物理削除
    vi.mocked(db.delete).mockReturnValueOnce(mockQueryChain([]) as never);
    // 既存フォルダの position シフト
    vi.mocked(db.update).mockReturnValueOnce(mockQueryChain([]) as never);
    // insert
    vi.mocked(db.insert).mockReturnValue(mockQueryChain([mockFolder]) as never);

    const res = await app.request('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/work' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual(mockFolder);
  });

  it('/ で始まらないパスでバリデーションエラーを返す', async () => {
    const res = await app.request('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'work' }),
    });

    expect(res.status).toBe(400);
  });

  it('空のパスで400を返す', async () => {
    const res = await app.request('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/' }),
    });

    expect(res.status).toBe(400);
  });

  it('空白を含むフォルダ名を作成できる', async () => {
    const folderWithSpaces = {
      ...mockFolder,
      name: 'Twenty One Pilots',
      path: '/Twenty One Pilots',
    };
    vi.mocked(db.delete).mockReturnValueOnce(mockQueryChain([]) as never);
    vi.mocked(db.update).mockReturnValueOnce(mockQueryChain([]) as never);
    vi.mocked(db.insert).mockReturnValue(mockQueryChain([folderWithSpaces]) as never);

    const res = await app.request('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/Twenty One Pilots' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Twenty One Pilots');
  });

  it('絵文字を含むフォルダ名を作成できる', async () => {
    const folderWithEmoji = {
      ...mockFolder,
      name: 'Linux 📝',
      path: '/Linux 📝',
    };
    vi.mocked(db.delete).mockReturnValueOnce(mockQueryChain([]) as never);
    vi.mocked(db.update).mockReturnValueOnce(mockQueryChain([]) as never);
    vi.mocked(db.insert).mockReturnValue(mockQueryChain([folderWithEmoji]) as never);

    const res = await app.request('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/Linux 📝' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Linux 📝');
  });

  it('空白のみのフォルダ名で400を返す', async () => {
    const res = await app.request('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/ ' }),
    });

    expect(res.status).toBe(400);
  });

  it('複数空白のみのフォルダ名で400を返す', async () => {
    const res = await app.request('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/   ' }),
    });

    expect(res.status).toBe(400);
  });

  it('先頭に空白を含むフォルダ名で400を返す', async () => {
    const res = await app.request('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/ work' }),
    });

    expect(res.status).toBe(400);
  });

  it('末尾に空白を含むフォルダ名で400を返す', async () => {
    const res = await app.request('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/work ' }),
    });

    expect(res.status).toBe(400);
  });

  it('末尾スラッシュ付きパスを正規化してフォルダを作成する', async () => {
    const normalizedFolder = {
      ...mockFolder,
      name: 'test',
      path: '/test',
    };
    vi.mocked(db.delete).mockReturnValueOnce(mockQueryChain([]) as never);
    vi.mocked(db.update).mockReturnValueOnce(mockQueryChain([]) as never);
    vi.mocked(db.insert).mockReturnValue(mockQueryChain([normalizedFolder]) as never);

    const res = await app.request('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/test/' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.path).toBe('/test');
  });

  it('存在しない親フォルダで404を返す', async () => {
    // 親フォルダ検索 → 見つからない
    vi.mocked(db.select).mockReturnValue(mockQueryChain([]) as never);

    const res = await app.request('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/parent/child' }),
    });

    expect(res.status).toBe(404);
  });

  it('ソフトデリート済みの同一パスフォルダを物理削除してから新規作成する', async () => {
    // ソフトデリート済みレコードの物理削除
    vi.mocked(db.delete).mockReturnValueOnce(mockQueryChain([]) as never);
    // 既存フォルダの position シフト
    vi.mocked(db.update).mockReturnValueOnce(mockQueryChain([]) as never);
    // insert
    vi.mocked(db.insert).mockReturnValue(mockQueryChain([mockFolder]) as never);

    const res = await app.request('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/work' }),
    });

    expect(res.status).toBe(201);
    expect(db.delete).toHaveBeenCalled();
  });
});

describe('PATCH /api/folders/:id', () => {
  it('フォルダ名を更新する', async () => {
    const updated = { ...mockFolder, name: 'updated', path: '/updated' };
    // フォルダ取得
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([mockFolder]) as never);
    // 子フォルダ取得（配下なし）
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([]) as never);

    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      const tx = {
        update: () => mockQueryChain([updated]),
      };
      return fn(tx as never);
    });

    const res = await app.request('/api/folders/folder-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'updated' }),
    });

    expect(res.status).toBe(200);
  });

  it('存在しないフォルダで404を返す', async () => {
    vi.mocked(db.select).mockReturnValue(mockQueryChain([]) as never);

    const res = await app.request('/api/folders/nonexistent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'updated' }),
    });

    expect(res.status).toBe(404);
  });

  it('空白のみの名前でリネームすると400を返す', async () => {
    const res = await app.request('/api/folders/folder-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '  ' }),
    });

    expect(res.status).toBe(400);
  });

  it('先頭・末尾に空白を含む名前でリネームすると400を返す', async () => {
    const res = await app.request('/api/folders/folder-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: ' work ' }),
    });

    expect(res.status).toBe(400);
  });

  it('フォルダを別の親フォルダに移動する', async () => {
    const sourceFolder = {
      ...mockFolder,
      id: 'folder-a',
      name: 'a',
      path: '/a',
      parentPath: null,
      position: 0,
    };
    const parentFolder = {
      ...mockFolder,
      id: 'folder-x',
      name: 'x',
      path: '/x',
      parentPath: null,
      position: 1,
    };

    // フォルダ取得
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([sourceFolder]) as never);
    // 親フォルダ存在チェック
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([parentFolder]) as never);
    // 子フォルダ取得（配下なし）
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([]) as never);
    // 移動先フォルダ内の既存アイテムの position を +1 シフト
    vi.mocked(db.update).mockReturnValueOnce(mockQueryChain([]) as never);

    const updatedFolder = {
      ...sourceFolder,
      name: 'a',
      path: '/x/a',
      parentPath: '/x',
      position: 0,
    };
    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      const tx = {
        update: () => mockQueryChain([updatedFolder]),
      };
      return fn(tx as never);
    });

    const res = await app.request('/api/folders/folder-a', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentPath: '/x' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.path).toBe('/x/a');
    expect(body.parentPath).toBe('/x');
  });

  it('ネストしたフォルダを移動する', async () => {
    const sourceFolder = {
      ...mockFolder,
      id: 'folder-a',
      name: 'a',
      path: '/a',
      parentPath: null,
      position: 0,
    };
    const childFolder = {
      ...mockFolder,
      id: 'folder-b',
      name: 'b',
      path: '/a/b',
      parentPath: '/a',
      position: 0,
    };

    // フォルダ取得
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([sourceFolder]) as never);
    // 親フォルダ存在チェック
    vi.mocked(db.select).mockReturnValueOnce(
      mockQueryChain([{ id: 'folder-x', name: 'x', path: '/x' }]) as never,
    );
    // 子フォルダ取得
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([childFolder]) as never);
    // 子フォルダ衝突チェック（衝突なし）
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([]) as never);
    // 移動先フォルダ内の既存アイテムの position を +1 シフト
    vi.mocked(db.update).mockReturnValueOnce(mockQueryChain([]) as never);

    const updatedFolder = { ...sourceFolder, path: '/x/a', parentPath: '/x', position: 0 };
    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      const tx = {
        update: () => mockQueryChain([updatedFolder]),
      };
      return fn(tx as never);
    });

    const res = await app.request('/api/folders/folder-a', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentPath: '/x' }),
    });

    expect(res.status).toBe(200);
    expect(db.transaction).toHaveBeenCalled();
  });

  it('子フォルダのパス衝突時に409を返す', async () => {
    const sourceFolder = {
      ...mockFolder,
      id: 'folder-a',
      name: 'a',
      path: '/a',
      parentPath: null,
      position: 0,
    };
    const childFolder = { path: '/a/b' };

    // フォルダ取得
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([sourceFolder]) as never);
    // 親フォルダ存在チェック
    vi.mocked(db.select).mockReturnValueOnce(
      mockQueryChain([{ id: 'folder-x', name: 'x', path: '/x' }]) as never,
    );
    // 子フォルダ取得
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([childFolder]) as never);
    // 子フォルダ衝突チェック（衝突あり）
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([{ id: 'existing-folder' }]) as never);

    const res = await app.request('/api/folders/folder-a', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentPath: '/x' }),
    });

    expect(res.status).toBe(409);
  });

  it('自分自身の配下への移動は400を返す', async () => {
    const sourceFolder = {
      ...mockFolder,
      id: 'folder-a',
      name: 'a',
      path: '/a',
      parentPath: null,
      position: 0,
    };

    // フォルダ取得
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([sourceFolder]) as never);
    // 親フォルダ存在チェック
    vi.mocked(db.select).mockReturnValueOnce(
      mockQueryChain([{ id: 'folder-a-b', name: 'b', path: '/a/b' }]) as never,
    );

    const res = await app.request('/api/folders/folder-a', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentPath: '/a/b' }),
    });

    expect(res.status).toBe(400);
  });

  it('存在しない親フォルダへの移動は404を返す', async () => {
    const sourceFolder = {
      ...mockFolder,
      id: 'folder-a',
      name: 'a',
      path: '/a',
      parentPath: null,
      position: 0,
    };

    // フォルダ取得
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([sourceFolder]) as never);
    // 親フォルダ存在チェック（見つからない）
    vi.mocked(db.select).mockReturnValueOnce(mockQueryChain([]) as never);

    const res = await app.request('/api/folders/folder-a', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentPath: '/nonexistent' }),
    });

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/folders/:id/position', () => {
  it('フォルダの位置を変更する', async () => {
    vi.mocked(db.select).mockReturnValue(mockQueryChain([mockFolder]) as never);
    vi.mocked(db.update).mockReturnValue(mockQueryChain([{ ...mockFolder, position: 2 }]) as never);

    const res = await app.request('/api/folders/folder-1/position', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position: 2 }),
    });

    expect(res.status).toBe(200);
  });

  it('同じ位置の場合はそのまま返す', async () => {
    vi.mocked(db.select).mockReturnValue(mockQueryChain([mockFolder]) as never);

    const res = await app.request('/api/folders/folder-1/position', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position: 0 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.position).toBe(0);
  });

  it('存在しないフォルダで404を返す', async () => {
    vi.mocked(db.select).mockReturnValue(mockQueryChain([]) as never);

    const res = await app.request('/api/folders/nonexistent/position', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position: 1 }),
    });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/folders/:id', () => {
  it('フォルダをソフトデリートする', async () => {
    vi.mocked(db.select).mockReturnValue(mockQueryChain([mockFolder]) as never);
    vi.mocked(db.update).mockReturnValue(mockQueryChain([]) as never);

    const res = await app.request('/api/folders/folder-1', {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it('存在しないフォルダで404を返す', async () => {
    vi.mocked(db.select).mockReturnValue(mockQueryChain([]) as never);

    const res = await app.request('/api/folders/nonexistent', {
      method: 'DELETE',
    });

    expect(res.status).toBe(404);
  });
});
