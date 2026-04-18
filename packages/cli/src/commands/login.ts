import { getApiUrl, saveToken } from '../config.js';

export async function loginCommand(): Promise<void> {
  const readline = await import('node:readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  const ask = (question: string): Promise<string> =>
    new Promise((resolve) => rl.question(question, resolve));

  try {
    const email = await ask('Email: ');
    const password = await ask('Password: ');

    const apiUrl = getApiUrl();
    const res = await fetch(`${apiUrl}/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('Login failed:', (body as { message?: string }).message ?? res.statusText);
      process.exit(1);
    }

    const token = res.headers.get('set-auth-token');
    if (!token) {
      console.error('Login failed: no auth token received');
      process.exit(1);
    }

    saveToken(token);
    console.log('Logged in successfully.');
  } finally {
    rl.close();
  }
}
