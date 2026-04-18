import { useRouter } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';

import { authClient } from '../lib/auth-client';

export function Layout({
  sidebar,
  children,
}: {
  sidebar?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await authClient.signOut();
      await router.navigate({ to: '/login' });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="flex h-screen">
      <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-gray-50 p-4">
        <h1 className="mb-4 text-lg font-bold">bkmk</h1>
        {sidebar}
        <div className="mt-auto">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            {loggingOut ? 'ログアウト中...' : 'ログアウト'}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-4">{children}</main>
    </div>
  );
}
