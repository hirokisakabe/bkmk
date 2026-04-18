import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockTrashGet = vi.fn();

vi.mock('../client.js', () => ({
  createClient: () => ({
    api: {
      trash: { $get: mockTrashGet },
    },
  }),
}));

import { trashCommand } from './trash.js';

describe('trashCommand', () => {
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
    mockTrashGet.mockReset();
  });

  it('displays trash contents', async () => {
    mockTrashGet.mockResolvedValue({
      ok: true,
      json: async () => ({
        folders: [{ id: 'f1', path: '/old' }],
        bookmarks: [{ id: 'bm-1', title: 'Old Bookmark', url: 'https://old.com' }],
      }),
    });

    await trashCommand({});

    expect(consoleSpy).toHaveBeenCalledWith('Folders:');
    expect(consoleSpy).toHaveBeenCalledWith('  f1  /old/');
    expect(consoleSpy).toHaveBeenCalledWith('Bookmarks:');
    expect(consoleSpy).toHaveBeenCalledWith('  bm-1  Old Bookmark');
  });

  it('shows empty message when trash is empty', async () => {
    mockTrashGet.mockResolvedValue({
      ok: true,
      json: async () => ({ folders: [], bookmarks: [] }),
    });

    await trashCommand({});

    expect(consoleSpy).toHaveBeenCalledWith('Trash is empty.');
  });
});
