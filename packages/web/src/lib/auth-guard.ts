import { redirect } from '@tanstack/react-router';

import { authClient } from './auth-client';

export async function getOptionalSession() {
  const session = await authClient.getSession();
  return { session: session.data };
}

export async function requireAuth() {
  const { session } = await getOptionalSession();
  if (!session) {
    throw redirect({ to: '/login' });
  }
  return session;
}

export async function requireGuest() {
  const session = await authClient.getSession();
  if (session.data) {
    throw redirect({ to: '/', search: {} });
  }
}
