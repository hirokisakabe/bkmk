import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFoldersGet = vi.fn();
const mockBookmarksGet = vi.fn();

vi.mock('../client.js', () => ({
  createClient: () => ({
    api: {
      folders: { $get: mockFoldersGet },
      bookmarks: { $get: mockBookmarksGet },
    },
  }),
}));

import { lsCommand } from './ls.js';

describe('lsCommand', () => {
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
    mockFoldersGet.mockReset();
    mockBookmarksGet.mockReset();
  });

  it('lists folders and bookmarks', async () => {
    mockFoldersGet.mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'f1', name: 'work', path: '/work', parentPath: null }],
    });
    mockBookmarksGet.mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 'bm-1', title: 'Example', url: 'https://example.com', folderPath: null },
      ],
    });

    await lsCommand(undefined, {});

    expect(consoleSpy).toHaveBeenCalledWith('  /work/');
    expect(consoleSpy).toHaveBeenCalledWith('  bm-1  Example');
  });

  it('shows empty message when no items', async () => {
    mockFoldersGet.mockResolvedValue({ ok: true, json: async () => [] });
    mockBookmarksGet.mockResolvedValue({ ok: true, json: async () => [] });

    await lsCommand(undefined, {});

    expect(consoleSpy).toHaveBeenCalledWith('(empty)');
  });

  it('outputs JSON when --json flag is used', async () => {
    const folders = [{ id: 'f1', name: 'work', path: '/work' }];
    const bookmarks = [{ id: 'bm-1', title: 'Example', url: 'https://example.com' }];

    mockFoldersGet.mockResolvedValue({ ok: true, json: async () => folders });
    mockBookmarksGet.mockResolvedValue({ ok: true, json: async () => bookmarks });

    await lsCommand(undefined, { json: true });

    expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify({ folders, bookmarks }, null, 2));
  });

  it('passes folder path and deep flag', async () => {
    mockFoldersGet.mockResolvedValue({ ok: true, json: async () => [] });
    mockBookmarksGet.mockResolvedValue({ ok: true, json: async () => [] });

    await lsCommand('/work', { deep: true });

    expect(mockFoldersGet).toHaveBeenCalledWith({ query: { parent: '/work' } });
    expect(mockBookmarksGet).toHaveBeenCalledWith({
      query: { folder: '/work', deep: 'true' },
    });
  });

  it('strips trailing slashes from folder path', async () => {
    mockFoldersGet.mockResolvedValue({ ok: true, json: async () => [] });
    mockBookmarksGet.mockResolvedValue({ ok: true, json: async () => [] });

    await lsCommand('/work/', {});

    expect(mockFoldersGet).toHaveBeenCalledWith({ query: { parent: '/work' } });
    expect(mockBookmarksGet).toHaveBeenCalledWith({
      query: { folder: '/work', deep: undefined },
    });
  });

  it('preserves root path when trailing slash is stripped', async () => {
    mockFoldersGet.mockResolvedValue({ ok: true, json: async () => [] });
    mockBookmarksGet.mockResolvedValue({ ok: true, json: async () => [] });

    await lsCommand('/', {});

    expect(mockFoldersGet).toHaveBeenCalledWith({ query: { parent: '/' } });
    expect(mockBookmarksGet).toHaveBeenCalledWith({
      query: { folder: '/', deep: undefined },
    });
  });
});
