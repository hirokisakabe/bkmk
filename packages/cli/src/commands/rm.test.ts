import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockBookmarkDelete = vi.fn();
const mockFolderDelete = vi.fn();
const mockTrashDelete = vi.fn();

vi.mock('../client.js', () => ({
  createClient: () => ({
    api: {
      bookmarks: { ':id': { $delete: mockBookmarkDelete } },
      folders: { ':id': { $delete: mockFolderDelete } },
      trash: { ':id': { $delete: mockTrashDelete } },
    },
  }),
}));

import { rmCommand } from './rm.js';

describe('rmCommand', () => {
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
    mockBookmarkDelete.mockReset();
    mockFolderDelete.mockReset();
    mockTrashDelete.mockReset();
  });

  it('soft deletes a bookmark', async () => {
    mockBookmarkDelete.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await rmCommand('bm-1', {});

    expect(mockBookmarkDelete).toHaveBeenCalledWith({ param: { id: 'bm-1' } });
    expect(consoleSpy).toHaveBeenCalledWith('Moved to trash.');
  });

  it('falls back to folder delete when bookmark not found', async () => {
    mockBookmarkDelete.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Bookmark not found' }),
    });
    mockFolderDelete.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await rmCommand('folder-1', {});

    expect(mockFolderDelete).toHaveBeenCalledWith({ param: { id: 'folder-1' } });
    expect(consoleSpy).toHaveBeenCalledWith('Moved to trash.');
  });

  it('permanently deletes with --force', async () => {
    mockTrashDelete.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await rmCommand('bm-1', { force: true });

    expect(mockTrashDelete).toHaveBeenCalledWith({ param: { id: 'bm-1' } });
    expect(consoleSpy).toHaveBeenCalledWith('Permanently deleted.');
  });
});
