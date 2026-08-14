import { createRouter } from '@tanstack/react-router';

import { forgotPasswordRoute } from './routes/forgot-password';
import { rootRoute } from './routes/__root';
import { indexRoute } from './routes/index';
import { loginRoute } from './routes/login';
import { resetPasswordRoute } from './routes/reset-password';
import { settingsRoute } from './routes/settings';
import { trashRoute } from './routes/trash';
import { verifyEmailRoute } from './routes/verify-email';

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  verifyEmailRoute,
  settingsRoute,
  trashRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
