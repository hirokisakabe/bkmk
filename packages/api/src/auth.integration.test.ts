import { PGlite } from '@electric-sql/pglite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

import { account, session, user, verification } from './db/schema.js';
import type { EmailSender, TransactionalEmail } from './email.js';

const testSchema = { account, session, user, verification };

describe('email verification and password reset', () => {
  let client: PGlite;
  let database: PgliteDatabase<typeof testSchema>;
  let auth: Awaited<ReturnType<(typeof import('./auth.js'))['createAuth']>>;
  let messages: TransactionalEmail[];

  beforeAll(async () => {
    process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-at-least-32-characters';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.BETTER_AUTH_TRUSTED_ORIGINS = 'http://localhost:5173';

    client = new PGlite();
    database = drizzle({ client, schema: testSchema });
    const testDir = dirname(fileURLToPath(import.meta.url));
    await migrate(database, { migrationsFolder: resolve(testDir, '../../../drizzle') });

    const emailSender: EmailSender = async (email) => {
      messages.push(email);
    };
    const { createAuth } = await import('./auth.js');
    auth = createAuth({ database, emailSender });
  });

  beforeEach(() => {
    messages = [];
  });

  afterAll(async () => {
    await client.close();
  });

  async function signUp(email: string, callbackURL = 'http://localhost:5173/verify-email') {
    await auth.api.signUpEmail({
      body: { email, password: 'password1234', name: email, callbackURL },
    });
    const message = messages.at(-1);
    expect(message?.subject).toContain('メールアドレス');
    return message!;
  }

  async function openLink(url: string): Promise<Response> {
    return auth.handler(
      new Request(url, {
        redirect: 'manual',
        headers: { origin: 'http://localhost:5173' },
      }),
    );
  }

  it('新規登録ユーザーを未確認で作成し、確認メールを送信する', async () => {
    const message = await signUp('new-user@example.com');
    const created = await database.query.user.findFirst({
      where: (table, { eq }) => eq(table.email, 'new-user@example.com'),
    });

    expect(created?.emailVerified).toBe(false);
    expect(message.to).toBe('new-user@example.com');
    expect(message.text).toContain('/auth/verify-email?token=');
  });

  it('未確認ユーザーのログインを拒否し、確認メールを再送する', async () => {
    await signUp('unverified@example.com');
    messages = [];

    await expect(
      auth.api.signInEmail({
        body: {
          email: 'unverified@example.com',
          password: 'password1234',
          callbackURL: 'http://localhost:5173/verify-email',
        },
      }),
    ).rejects.toMatchObject({ body: { code: 'EMAIL_NOT_VERIFIED' }, statusCode: 403 });
    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toContain('/auth/verify-email?token=');
  });

  it('有効な確認リンクで確認済みになり、ログインできる', async () => {
    const message = await signUp('verify-success@example.com');
    const verificationUrl = message.text.split('\n').find((line) => line.startsWith('http'))!;

    const response = await openLink(verificationUrl);
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('http://localhost:5173/verify-email');

    const verified = await database.query.user.findFirst({
      where: (table, { eq }) => eq(table.email, 'verify-success@example.com'),
    });
    expect(verified?.emailVerified).toBe(true);

    const result = await auth.api.signInEmail({
      body: { email: 'verify-success@example.com', password: 'password1234' },
    });
    expect(result.user.email).toBe('verify-success@example.com');
  });

  it('無効な確認トークンを処理せず、callback にエラーを返す', async () => {
    const response = await openLink(
      'http://localhost:3000/auth/verify-email?token=invalid&callbackURL=http%3A%2F%2Flocalhost%3A5173%2Fverify-email',
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'http://localhost:5173/verify-email?error=INVALID_TOKEN',
    );
  });

  it('再設定要求は登録有無にかかわらず同じ結果を返す', async () => {
    const message = await signUp('reset-request@example.com');
    await openLink(message.text.split('\n').find((line) => line.startsWith('http'))!);
    messages = [];

    const known = await auth.api.requestPasswordReset({
      body: {
        email: 'reset-request@example.com',
        redirectTo: 'http://localhost:5173/reset-password',
      },
    });
    const unknown = await auth.api.requestPasswordReset({
      body: {
        email: 'missing@example.com',
        redirectTo: 'http://localhost:5173/reset-password',
      },
    });

    expect(known).toEqual(unknown);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.subject).toContain('パスワード');
  });

  it('有効な再設定リンクでパスワードを変更できる', async () => {
    const verificationMessage = await signUp('reset-success@example.com');
    await openLink(verificationMessage.text.split('\n').find((line) => line.startsWith('http'))!);
    messages = [];
    await auth.api.requestPasswordReset({
      body: {
        email: 'reset-success@example.com',
        redirectTo: 'http://localhost:5173/reset-password',
      },
    });
    const resetUrl = messages[0]!.text.split('\n').find((line) => line.startsWith('http'))!;
    const callback = await openLink(resetUrl);
    const token = new URL(callback.headers.get('location')!).searchParams.get('token')!;

    await auth.api.resetPassword({ body: { newPassword: 'new-password1234', token } });

    await expect(
      auth.api.signInEmail({
        body: { email: 'reset-success@example.com', password: 'password1234' },
      }),
    ).rejects.toMatchObject({ statusCode: 401 });
    const result = await auth.api.signInEmail({
      body: { email: 'reset-success@example.com', password: 'new-password1234' },
    });
    expect(result.user.email).toBe('reset-success@example.com');
  });

  it('期限切れの再設定リンクを処理せず、callback にエラーを返す', async () => {
    const verificationMessage = await signUp('expired-reset@example.com');
    await openLink(verificationMessage.text.split('\n').find((line) => line.startsWith('http'))!);
    messages = [];
    await auth.api.requestPasswordReset({
      body: {
        email: 'expired-reset@example.com',
        redirectTo: 'http://localhost:5173/reset-password',
      },
    });
    const resetUrl = messages[0]!.text.split('\n').find((line) => line.startsWith('http'))!;
    await database.update(verification).set({ expiresAt: new Date(0) });

    const response = await openLink(resetUrl);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'http://localhost:5173/reset-password?error=INVALID_TOKEN',
    );
  });

  it('メール送信失敗の詳細を認証レスポンスへ露出しない', async () => {
    const { createAuth } = await import('./auth.js');
    const failingAuth = createAuth({
      database,
      emailSender: async () => {
        throw new Error('re_super-secret-provider-token');
      },
    });

    const result = await failingAuth.api.requestPasswordReset({
      body: {
        email: 'missing-failure@example.com',
        redirectTo: 'http://localhost:5173/reset-password',
      },
    });

    expect(JSON.stringify(result)).not.toContain('re_super-secret-provider-token');
    expect(result.status).toBe(true);
  });
});
