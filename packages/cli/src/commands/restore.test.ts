import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockRestorePost = vi.fn();

vi.mock('../client.js', () => ({
  createClient: () => ({
    api: {
      trash: {
        ':id': {
          restore: { $post: mockRestorePost },
        },
      },
    },
  }),
}));

import { restoreCommand } from './restore.js';

describe('restoreCommand', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockRestorePost.mockReset();
  });

  it('restores an item from trash', async () => {
    mockRestorePost.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await restoreCommand('bm-1', {});

    expect(mockRestorePost).toHaveBeenCalledWith({ param: { id: 'bm-1' } });
    expect(consoleSpy).toHaveBeenCalledWith('Restored successfully.');
  });

  it('exits with error when item not found', async () => {
    mockRestorePost.mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
      json: async () => ({ error: 'Item not found in trash' }),
    });

    await expect(restoreCommand('nonexistent', {})).rejects.toThrow('process.exit');
  });
});
