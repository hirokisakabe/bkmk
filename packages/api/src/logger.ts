import type { Context } from 'hono';
import pino from 'pino';
import { pinoLogger } from 'hono-pino';

const isProduction = process.env.NODE_ENV === 'production';

export const rootLogger = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
        },
      }),
});

export const logger = pinoLogger({
  pino: rootLogger,
  http: {
    referRequestIdKey: 'requestId',
    onReqBindings: (c: Context) => ({
      req: {
        url: c.req.path,
        method: c.req.method,
      },
    }),
    onResBindings: (c: Context) => ({
      res: {
        status: c.res.status,
      },
    }),
    onResLevel: (c: Context) => {
      if (c.req.path === '/health') return 'trace';
      const status = c.res.status;
      if (status >= 500) return 'error';
      if (status >= 400) return 'warn';
      return 'info';
    },
  },
});
