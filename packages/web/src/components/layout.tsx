import type { ReactNode } from 'react';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen">
      <aside className="w-64 shrink-0 border-r border-gray-200 bg-gray-50 p-4">
        <h1 className="text-lg font-bold">bkmk</h1>
      </aside>
      <main className="flex-1 overflow-y-auto p-4">{children}</main>
    </div>
  );
}
