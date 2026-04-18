import { createRoute, Link, useRouter } from '@tanstack/react-router';
import { useState } from 'react';

import { Layout } from '../components/layout';
import { authClient } from '../lib/auth-client';
import { requireAuth } from '../lib/auth-guard';
import { useSettings } from '../lib/settings-store';
import { rootRoute } from './__root';

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  beforeLoad: requireAuth,
  component: SettingsPage,
});

function SettingsPage() {
  const [settings, updateSettings] = useSettings();
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
    <Layout>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <Link
            to="/"
            search={{ folder: null, q: null }}
            className="text-gray-400 hover:text-gray-600"
          >
            <ArrowLeftIcon />
          </Link>
          <h2 className="text-xl font-bold text-gray-900">設定</h2>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h3 className="font-medium text-gray-900">表示</h3>
          </div>
          <div className="px-4 py-4">
            <label className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">サブフォルダを含む</p>
                <p className="text-sm text-gray-500">
                  フォルダ選択時にサブフォルダ内のブックマークも表示します
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.includeSubfolders}
                onChange={(e) => updateSettings({ includeSubfolders: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
            </label>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h3 className="font-medium text-gray-900">アカウント</h3>
          </div>
          <div className="px-4 py-4">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            >
              {loggingOut ? 'ログアウト中...' : 'ログアウト'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function ArrowLeftIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
        clipRule="evenodd"
      />
    </svg>
  );
}
