import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockPost = vi.fn();

vi.mock('../client.js', () => ({
  createClient: () => ({
    api: {
      folders: {
        $post: mockPost,
      },
    },
  }),
}));

import { mkdirCommand } from './mkdir.js';

describe('mkdirCommand', () => {
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

  it('creates a folder and prints path', async () => {
    mockPost.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'folder-1',
        name: 'work',
        path: '/work',
        parentPath: null,
        position: 0,
      }),
    });

    await mkdirCommand('/work', { json: false });

    expect(mockPost).toHaveBeenCalledWith({ json: { path: '/work' } });
    expect(consoleSpy).toHaveBeenCalledWith('Created: /work');
  });

  it('outputs JSON when --json flag is used', async () => {
    const folder = {
      id: 'folder-1',
      name: 'work',
      path: '/work',
      parentPath: null,
      position: 0,
    };

    mockPost.mockResolvedValue({
      ok: true,
      json: async () => folder,
    });

    await mkdirCommand('/work', { json: true });

    expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(folder, null, 2));
  });

  it('exits with error when creation fails', async () => {
    mockPost.mockResolvedValue({
      ok: false,
      statusText: 'Conflict',
      json: async () => ({ error: 'Folder already exists at this path' }),
    });

    await expect(mkdirCommand('/work', {})).rejects.toThrow('process.exit');
  });
});
