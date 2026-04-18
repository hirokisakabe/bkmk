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
import { foldersRoute } from './folders.js';

const app = createTestApp('/api/folders', foldersRoute);

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
    vi.mocked(db.select).mockReturnValue(mockQueryChain([]) as never);

    const res = await app.request('/api/folders?parent=/work');
    expect(res.status).toBe(200);
  });
});

describe('POST /api/folders', () => {
  it('フォルダを作成する', async () => {
    // maxPos クエリ
    vi.mocked(db.select).mockReturnValue(mockQueryChain([{ max: -1 }]) as never);
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
});

describe('PATCH /api/folders/:id', () => {
  it('フォルダ名を更新する', async () => {
    const updated = { ...mockFolder, name: 'updated' };
    vi.mocked(db.select).mockReturnValue(mockQueryChain([mockFolder]) as never);
    vi.mocked(db.update).mockReturnValue(mockQueryChain([updated]) as never);

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
