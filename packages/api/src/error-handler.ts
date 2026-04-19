import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { rootLogger } from './logger.js';

export function errorHandler(err: Error, c: Context) {
  const logger = c.var?.logger;

  if (err instanceof HTTPException) {
    const level = err.status >= 500 ? 'error' : 'warn';
    const logPayload = {
      err,
      req: { method: c.req.method, path: c.req.path },
    };

    if (logger) {
      logger[level](logPayload, err.message);
    } else {
      rootLogger[level](logPayload, err.message);
    }

    return c.json({ error: err.message }, err.status);
  }

  const logPayload = {
    err,
    req: { method: c.req.method, path: c.req.path },
  };

  if (logger) {
    logger.error(logPayload, 'Internal Server Error');
  } else {
    rootLogger.error(logPayload, 'Internal Server Error');
  }

  return c.json({ error: 'Internal Server Error' }, 500);
}
