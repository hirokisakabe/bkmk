import type { ReactNode } from 'react';

export function Layout({
  sidebar,
  children,
}: {
  sidebar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-gray-50 p-4">
        <h1 className="mb-4 text-lg font-bold">bkmk</h1>
        {sidebar}
      </aside>
      <main className="flex-1 overflow-y-auto p-4">{children}</main>
    </div>
  );
}
