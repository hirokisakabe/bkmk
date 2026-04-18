import { createClient } from '../client.js';

interface RmOptions {
  force?: boolean;
  json?: boolean;
}

export async function rmCommand(id: string, options: RmOptions): Promise<void> {
  const client = createClient();

  if (options.force) {
    // 完全削除（ゴミ箱から）
    const res = await client.api.trash[':id'].$delete({
      param: { id },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error(
        'Failed to permanently delete:',
        (body as { error?: string }).error ?? res.statusText,
      );
      process.exit(1);
    }

    const result = await res.json();
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('Permanently deleted.');
    }
    return;
  }

  // ソフトデリート: ブックマーク → フォルダの順で試行
  const bookmarkRes = await client.api.bookmarks[':id'].$delete({
    param: { id },
  });

  if (bookmarkRes.ok) {
    const result = await bookmarkRes.json();
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('Moved to trash.');
    }
    return;
  }

  const folderRes = await client.api.folders[':id'].$delete({
    param: { id },
  });

  if (folderRes.ok) {
    const result = await folderRes.json();
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('Moved to trash.');
    }
    return;
  }

  const body = await folderRes.json().catch(() => ({}));
  console.error('Delete failed:', (body as { error?: string }).error ?? 'Item not found');
  process.exit(1);
}
