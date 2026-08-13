import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { createRoute, Link, useRouter } from '@tanstack/react-router';
import { useState } from 'react';

import { Layout } from '../components/layout';
import { useDeleteAccount } from '../hooks/use-user';
import { authClient } from '../lib/auth-client';
import { requireAuth } from '../lib/auth-guard';
import { downloadBookmarkExport } from '../lib/bookmark-export';
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
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deleteAccount = useDeleteAccount();

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await authClient.signOut();
      await router.navigate({ to: '/login' });
    } finally {
      setLoggingOut(false);
    }
  };

  const handleDeleteAccount = () => {
    deleteAccount.mutate(undefined, {
      onSuccess: async () => {
        setDeleteDialogOpen(false);
        await authClient.signOut();
        await router.navigate({ to: '/login' });
      },
    });
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await downloadBookmarkExport();
    } catch {
      setExportError('エクスポートに失敗しました。時間をおいてもう一度お試しください。');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/" search={{}} className="text-gray-400 hover:text-gray-600">
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
            <h3 className="font-medium text-gray-900">データのエクスポート</h3>
          </div>
          <div className="px-4 py-4">
            <p className="mb-3 text-sm text-gray-500">
              すべてのブックマークを CSV ファイルでダウンロードします。
            </p>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {exporting ? 'エクスポート中...' : 'CSV をダウンロード'}
            </button>
            {exportError && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {exportError}
              </p>
            )}
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

        <div className="mt-6 rounded-lg border border-red-200 bg-white">
          <div className="border-b border-red-200 px-4 py-3">
            <h3 className="font-medium text-red-600">危険な操作</h3>
          </div>
          <div className="px-4 py-4">
            <p className="mb-3 text-sm text-gray-500">
              アカウントを削除すると、すべてのブックマーク・フォルダ・セッションが完全に削除されます。この操作は取り消せません。
            </p>
            <button
              onClick={() => setDeleteDialogOpen(true)}
              className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
            >
              アカウントを削除
            </button>
          </div>
        </div>

        <AlertDialog.Root open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialog.Portal>
            <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
            <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
              <AlertDialog.Title className="mb-2 text-lg font-bold">
                アカウント削除
              </AlertDialog.Title>
              <AlertDialog.Description className="mb-4 text-sm text-gray-500">
                本当にアカウントを削除しますか？すべてのデータが完全に削除され、この操作は取り消せません。
              </AlertDialog.Description>

              {deleteAccount.isError && (
                <p className="mb-4 text-sm text-red-600">{deleteAccount.error.message}</p>
              )}

              <div className="flex justify-end gap-2">
                <AlertDialog.Cancel asChild>
                  <button
                    type="button"
                    className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                  >
                    キャンセル
                  </button>
                </AlertDialog.Cancel>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteAccount.isPending}
                  className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteAccount.isPending ? '削除中...' : '削除する'}
                </button>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
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
