import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSearchGet = vi.fn();

vi.mock('../client.js', () => ({
  createClient: () => ({
    api: {
      search: { $get: mockSearchGet },
    },
  }),
}));

import { searchCommand } from './search.js';

describe('searchCommand', () => {
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
    mockSearchGet.mockReset();
  });

  it('displays search results', async () => {
    mockSearchGet.mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 'bm-1', title: 'Example', url: 'https://example.com', folderPath: '/work' },
      ],
    });

    await searchCommand('example', {});

    expect(mockSearchGet).toHaveBeenCalledWith({ query: { q: 'example' } });
    expect(consoleSpy).toHaveBeenCalledWith('  bm-1  Example');
  });

  it('shows no results message', async () => {
    mockSearchGet.mockResolvedValue({ ok: true, json: async () => [] });

    await searchCommand('notfound', {});

    expect(consoleSpy).toHaveBeenCalledWith('No results found.');
  });
});
