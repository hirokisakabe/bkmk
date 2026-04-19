import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { PinoLogger } from 'hono-pino';
import pino from 'pino';
import { describe, expect, it } from 'vitest';

import { errorHandler } from './error-handler.js';

function createApp() {
  const app = new Hono();

  app.use('*', async (c, next) => {
    c.set('logger', new PinoLogger(pino({ level: 'silent' })));
    await next();
  });

  app.onError(errorHandler);

  return app;
}

describe('errorHandler', () => {
  describe('HTTPException', () => {
    it('400 エラーを warn レベルでログ出力し JSON レスポンスを返す', async () => {
      const app = createApp();
      app.get('/test', () => {
        throw new HTTPException(400, { message: 'Bad Request' });
      });

      const res = await app.request('/test');
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body).toEqual({ error: 'Bad Request' });
    });

    it('404 エラーを warn レベルでログ出力し JSON レスポンスを返す', async () => {
      const app = createApp();
      app.get('/test', () => {
        throw new HTTPException(404, { message: 'Not Found' });
      });

      const res = await app.request('/test');
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body).toEqual({ error: 'Not Found' });
    });

    it('500 HTTPException を error レベルでログ出力する', async () => {
      const app = createApp();
      app.get('/test', () => {
        throw new HTTPException(500, { message: 'Server Error' });
      });

      const res = await app.request('/test');
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body).toEqual({ error: 'Server Error' });
    });
  });

  describe('予期しないエラー', () => {
    it('500 レスポンスを返しエラー詳細を隠す', async () => {
      const app = createApp();
      app.get('/test', () => {
        throw new Error('Unexpected database failure');
      });

      const res = await app.request('/test');
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body).toEqual({ error: 'Internal Server Error' });
    });
  });

  describe('logger が未設定の場合', () => {
    it('rootLogger にフォールバックして 500 を返す', async () => {
      const app = new Hono();
      app.onError(errorHandler);
      app.get('/test', () => {
        throw new Error('No logger');
      });

      const res = await app.request('/test');
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body).toEqual({ error: 'Internal Server Error' });
    });
  });
});
