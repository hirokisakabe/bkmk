import { hc } from 'hono/client';

import type { AppType } from '@bkmk/api';

import { getApiUrl, getToken } from './config.js';

export function createClient() {
  const token = getToken();
  if (!token) {
    console.error('Not logged in. Run `bkmk login` first.');
    process.exit(1);
  }

  return hc<AppType>(getApiUrl(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
