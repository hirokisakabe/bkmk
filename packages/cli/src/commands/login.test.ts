import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config.js', () => ({
  getApiUrl: vi.fn().mockReturnValue('http://localhost:3000'),
  saveToken: vi.fn(),
}));

import { saveToken } from '../config.js';

describe('loginCommand', () => {
  let mockReadline: { question: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockReadline = {
      question: vi.fn(),
      close: vi.fn(),
    };

    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('saves token on successful login', async () => {
    mockReadline.question
      .mockImplementationOnce((_q: string, cb: (a: string) => void) => cb('user@example.com'))
      .mockImplementationOnce((_q: string, cb: (a: string) => void) => cb('password123'));

    const mockCreateInterface = vi.fn().mockReturnValue(mockReadline);
    vi.doMock('node:readline', () => ({
      createInterface: mockCreateInterface,
    }));

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'set-auth-token': 'test-bearer-token' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    // 動的 import でモックを適用
    const { loginCommand } = await import('./login.js');
    await loginCommand();

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
      body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
    });
    expect(saveToken).toHaveBeenCalledWith('test-bearer-token');
  });

  it('exits with error on failed login', async () => {
    mockReadline.question
      .mockImplementationOnce((_q: string, cb: (a: string) => void) => cb('user@example.com'))
      .mockImplementationOnce((_q: string, cb: (a: string) => void) => cb('wrong'));

    const mockCreateInterface = vi.fn().mockReturnValue(mockReadline);
    vi.doMock('node:readline', () => ({
      createInterface: mockCreateInterface,
    }));

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Unauthorized',
      json: async () => ({ message: 'Invalid credentials' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { loginCommand } = await import('./login.js');
    await expect(loginCommand()).rejects.toThrow('process.exit');
  });
});
