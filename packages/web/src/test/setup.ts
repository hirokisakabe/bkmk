import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { server } from './server';

// better-auth クライアントは MSW をバイパスするため、auth-guard をモック
vi.mock('../lib/auth-guard', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: {
      id: 'test-user',
      name: 'Test User',
      email: 'test@example.com',
    },
    session: {
      id: 'test-session',
      userId: 'test-user',
    },
  }),
  requireGuest: vi.fn().mockResolvedValue(undefined),
}));

// jsdom 未実装の scrollTo をスタブ
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
