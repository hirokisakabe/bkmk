import { execFile } from 'node:child_process';

import { createClient } from '../client.js';

interface OpenOptions {
  json?: boolean;
}

function openUrl(url: string): void {
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
  execFile(cmd, [url]);
}

export async function openCommand(id: string, options: OpenOptions): Promise<void> {
  const client = createClient();

  // ブックマーク一覧から探す（全件取得して ID フィルタ）
  // 直接 ID で取得する API がないので、search は使えない
  // bookmarks の GET は folder ベースなので、全件取得して探す
  const res = await client.api.bookmarks.$get({
    query: { deep: 'true' },
  });

  if (!res.ok) {
    console.error('Failed to fetch bookmarks');
    process.exit(1);
  }

  const allBookmarks = await res.json();
  const bookmark = allBookmarks.find((b) => b.id === id);

  if (!bookmark) {
    console.error('Bookmark not found');
    process.exit(1);
  }

  if (options.json) {
    console.log(JSON.stringify(bookmark, null, 2));
  } else {
    console.log(`Opening: ${bookmark.url}`);
  }

  openUrl(bookmark.url);
}
