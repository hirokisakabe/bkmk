import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockPost = vi.fn();

vi.mock('../client.js', () => ({
  createClient: () => ({
    api: {
      bookmarks: {
        $post: mockPost,
      },
    },
  }),
}));

import { addCommand } from './add.js';

describe('addCommand', () => {
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
    mockPost.mockReset();
  });

  it('adds a bookmark and prints summary', async () => {
    const bookmark = {
      id: 'bm-1',
      url: 'https://example.com',
      title: 'Example',
      folderPath: null,
    };

    mockPost.mockResolvedValue({
      ok: true,
      json: async () => bookmark,
    });

    await addCommand('https://example.com', {});

    expect(mockPost).toHaveBeenCalledWith({
      json: { url: 'https://example.com', folderPath: null },
    });
    expect(consoleSpy).toHaveBeenCalledWith('Added: Example');
  });

  it('adds a bookmark to a specific folder', async () => {
    const bookmark = {
      id: 'bm-1',
      url: 'https://example.com',
      title: 'Example',
      folderPath: '/work',
    };

    mockPost.mockResolvedValue({
      ok: true,
      json: async () => bookmark,
    });

    await addCommand('https://example.com', { folder: '/work' });

    expect(mockPost).toHaveBeenCalledWith({
      json: { url: 'https://example.com', folderPath: '/work' },
    });
  });

  it('outputs JSON when --json flag is used', async () => {
    const bookmark = {
      id: 'bm-1',
      url: 'https://example.com',
      title: 'Example',
      folderPath: null,
    };

    mockPost.mockResolvedValue({
      ok: true,
      json: async () => bookmark,
    });

    await addCommand('https://example.com', { json: true });

    expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(bookmark, null, 2));
  });

  it('exits with error on failure', async () => {
    mockPost.mockResolvedValue({
      ok: false,
      statusText: 'Conflict',
      json: async () => ({ error: 'このURLはすでに登録されています' }),
    });

    await expect(addCommand('https://example.com', {})).rejects.toThrow('process.exit');
  });
});
