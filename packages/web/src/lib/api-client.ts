import { hc } from 'hono/client';

import type { AppType } from '@bkmk/api';

export const client = hc<AppType>('/', {
  init: { credentials: 'include' },
});
