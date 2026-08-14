import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';

import { db } from './db/index.js';
import {
  type EmailDeliveryFailureType,
  type EmailSender,
  sanitizeEmailDeliveryError,
  sendEmailVerification,
  sendPasswordReset,
  sendTransactionalEmail,
} from './email.js';
import { rootLogger } from './logger.js';

interface EmailDeliveryLogger {
  error(
    bindings: {
      event: 'auth_email_delivery_failed';
      failureType: EmailDeliveryFailureType;
      purpose: 'password_reset' | 'verification';
      requestId: string;
    },
    message: string,
  ): void;
}

interface CreateAuthOptions {
  database?: Parameters<typeof drizzleAdapter>[0];
  emailDeliveryLogger?: EmailDeliveryLogger;
  emailSender?: EmailSender;
  passwordResetResponseDelay?: () => number;
}

const defaultPasswordResetResponseDelay = () => 800 + Math.floor(Math.random() * 400);

async function waitForMinimumResponseTime(startedAt: number, minimumMs: number): Promise<void> {
  const remainingMs = minimumMs - (performance.now() - startedAt);
  if (remainingMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, remainingMs));
  }
}

async function deliverAuthEmail(
  purpose: 'password_reset' | 'verification',
  request: Request | undefined,
  deliver: () => Promise<void>,
  logger: EmailDeliveryLogger,
): Promise<void> {
  try {
    await deliver();
  } catch (error) {
    const sanitizedError = sanitizeEmailDeliveryError(error);
    logger.error(
      {
        event: 'auth_email_delivery_failed',
        failureType: sanitizedError.failureType,
        purpose,
        requestId: request?.headers.get('x-request-id') ?? crypto.randomUUID(),
      },
      'Authentication email delivery failed',
    );
    throw sanitizedError;
  }
}

export function createAuth(options: CreateAuthOptions = {}) {
  const emailSender = options.emailSender ?? sendTransactionalEmail;
  const emailDeliveryLogger = options.emailDeliveryLogger ?? rootLogger;
  const passwordResetResponseDelay =
    options.passwordResetResponseDelay ?? defaultPasswordResetResponseDelay;

  const auth = betterAuth({
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
      sendVerificationEmail: async ({ user, url }, request) => {
        await deliverAuthEmail(
          'verification',
          request,
          () => sendEmailVerification(emailSender, { email: user.email, url }),
          emailDeliveryLogger,
        );
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }, request) => {
        await deliverAuthEmail(
          'password_reset',
          request,
          () => sendPasswordReset(emailSender, { email: user.email, url }),
          emailDeliveryLogger,
        );
      },
    },
    plugins: [bearer()],
  });

  const handler = auth.handler;

  return {
    ...auth,
    handler: async (request: Request) => {
      const isPasswordResetRequest =
        request.method === 'POST' &&
        new URL(request.url).pathname === '/auth/request-password-reset';
      if (!isPasswordResetRequest) return handler(request);

      const startedAt = performance.now();
      try {
        return await handler(request);
      } finally {
        // 既知・未知アカウントの処理時間差から登録有無を推測しにくくする。
        await waitForMinimumResponseTime(startedAt, passwordResetResponseDelay());
      }
    },
  };
}

export const auth = createAuth();
