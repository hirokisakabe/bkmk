import { useRouter } from '@tanstack/react-router';
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
