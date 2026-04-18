import { Link, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { authClient } from '../lib/auth-client';

export function Layout({
  sidebar,
  children,
  searchInput,
}: {
  sidebar?: ReactNode;
  children: ReactNode;
  searchInput?: ReactNode;
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
        {searchInput}
        {sidebar}
        <div className="mt-auto space-y-2">
          <Link
            to="/trash"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <TrashIcon />
            ゴミ箱
          </Link>
          <Link
            to="/settings"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <SettingsIcon />
            設定
          </Link>
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

export function SearchInput({
  defaultValue,
  onSearch,
}: {
  defaultValue: string;
  onSearch: (query: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = (input: string) => {
    setValue(input);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(input.trim());
    }, 300);
  };

  return (
    <div className="relative mb-4">
      <SearchIcon />
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="ブックマークを検索..."
        className="w-full rounded-md border border-gray-300 py-1.5 pr-2 pl-8 text-sm placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
      />
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
        clipRule="evenodd"
      />
    </svg>
  );
}
