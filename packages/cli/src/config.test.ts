import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getApiUrl, getConfig, getToken, saveToken } from './config.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bkmk-cli-test-'));
  vi.stubEnv('HOME', tmpDir);
  // os.homedir() は環境変数ではなくキャッシュを使うことがあるので mock
  vi.spyOn(os, 'homedir').mockReturnValue(tmpDir);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('config', () => {
  describe('getConfig', () => {
    it('returns default config when no file exists', () => {
      const config = getConfig();
      expect(config.apiUrl).toBe('https://bkmk.tokyo');
    });
  });

  describe('getApiUrl', () => {
    it('returns default API URL', () => {
      expect(getApiUrl()).toBe('https://bkmk.tokyo');
    });
  });

  describe('getToken / saveToken', () => {
    it('returns null when no session file exists', () => {
      expect(getToken()).toBeNull();
    });

    it('saves and retrieves a token', () => {
      saveToken('test-token-123');
      expect(getToken()).toBe('test-token-123');
    });

    it('overwrites existing token', () => {
      saveToken('first-token');
      saveToken('second-token');
      expect(getToken()).toBe('second-token');
    });
  });
});
