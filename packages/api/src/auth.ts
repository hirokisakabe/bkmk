import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';

import { db } from './db/index.js';
import {
  type EmailSender,
  sendEmailVerification,
  sendPasswordReset,
  sendTransactionalEmail,
} from './email.js';

interface CreateAuthOptions {
  database?: Parameters<typeof drizzleAdapter>[0];
  emailSender?: EmailSender;
}

export function createAuth(options: CreateAuthOptions = {}) {
  const emailSender = options.emailSender ?? sendTransactionalEmail;

  return betterAuth({
    basePath: '/auth',
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: [
      process.env.BETTER_AUTH_URL ?? '',
      ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',').filter(Boolean) ?? []),
    ],
    database: drizzleAdapter(options.database ?? db, {
      provider: 'pg',
    }),
    emailVerification: {
      expiresIn: 60 * 60,
      sendOnSignUp: true,
      sendOnSignIn: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmailVerification(emailSender, { email: user.email, url });
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendPasswordReset(emailSender, { email: user.email, url });
      },
    },
    advanced: {
      // 認証 API の応答をメールプロバイダーの待ち時間から切り離し、列挙攻撃を抑える。
      backgroundTasks: {
        handler: () => undefined,
      },
    },
    plugins: [bearer()],
  });
}

export const auth = createAuth();
