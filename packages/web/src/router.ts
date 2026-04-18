import { createRouter } from '@tanstack/react-router';

import { rootRoute } from './routes/__root';
import { indexRoute } from './routes/index';
import { loginRoute } from './routes/login';
import { settingsRoute } from './routes/settings';
import { trashRoute } from './routes/trash';

const routeTree = rootRoute.addChildren([indexRoute, loginRoute, settingsRoute, trashRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
