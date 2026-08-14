import type { ReactNode } from 'react';

interface AuthShellProps {
  children: ReactNode;
  eyebrow: string;
  title: string;
}

export function AuthShell({ children, eyebrow, title }: AuthShellProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-950">
      <section className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] sm:px-8">
        <div
          aria-hidden="true"
          className="absolute top-0 right-7 h-9 w-5 rounded-b-full bg-blue-600"
        />
        <p className="mb-2 font-mono text-xs font-semibold tracking-[0.18em] text-blue-700 uppercase">
          {eyebrow}
        </p>
        <h1 className="mb-7 text-2xl font-bold tracking-tight">{title}</h1>
        {children}
      </section>
    </main>
  );
}

export const authInputClassName =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100';

export const authPrimaryButtonClassName =
  'w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50';

export const authTextButtonClassName =
  'font-medium text-blue-700 underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';
