import { describe, expect, it, vi } from 'vitest';

import { createTestApp, mockQueryChain } from '../test/helpers.js';

// db モック
vi.mock('../db/index.js', () => ({
  db: {
    delete: vi.fn(),
  },
}));

import { db } from '../db/index.js';
import { userRoute } from './user.js';

const app = createTestApp('/api/user', userRoute);

describe('DELETE /api/user', () => {
  it('ユーザーを削除して成功レスポンスを返す', async () => {
    vi.mocked(db.delete).mockReturnValue(mockQueryChain([]) as never);

    const res = await app.request('/api/user', { method: 'DELETE' });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ success: true });

    expect(db.delete).toHaveBeenCalled();
  });

  it('DB エラー時に 500 を返す', async () => {
    vi.mocked(db.delete).mockReturnValue(
      mockQueryChain(Promise.reject(new Error('DB error')) as never) as never,
    );

    const res = await app.request('/api/user', { method: 'DELETE' });
    expect(res.status).toBe(500);
  });
});
