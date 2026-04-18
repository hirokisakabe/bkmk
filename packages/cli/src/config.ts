import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function getConfigDir(): string {
  return path.join(os.homedir(), '.config', 'bkmk');
}

function getConfigFile(): string {
  return path.join(getConfigDir(), 'config.json');
}

function getSessionFile(): string {
  return path.join(getConfigDir(), 'session.json');
}

const DEFAULT_API_URL = 'https://bkmk-680461270704.asia-northeast1.run.app';

interface Config {
  apiUrl: string;
}

interface Session {
  token: string;
}

function ensureConfigDir(): void {
  fs.mkdirSync(getConfigDir(), { recursive: true });
}

export function getConfig(): Config {
  try {
    const raw = fs.readFileSync(getConfigFile(), 'utf-8');
    return JSON.parse(raw) as Config;
  } catch {
    return { apiUrl: DEFAULT_API_URL };
  }
}

export function getApiUrl(): string {
  return getConfig().apiUrl;
}

export function getToken(): string | null {
  try {
    const raw = fs.readFileSync(getSessionFile(), 'utf-8');
    const session = JSON.parse(raw) as Session;
    return session.token;
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  ensureConfigDir();
  fs.writeFileSync(getSessionFile(), JSON.stringify({ token }, null, 2) + '\n');
}
