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
  http: false,
});
