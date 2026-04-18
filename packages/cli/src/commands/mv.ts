import { createClient } from '../client.js';

interface MvOptions {
  json?: boolean;
}

export async function mvCommand(id: string, newPath: string, options: MvOptions): Promise<void> {
  const client = createClient();

  // ブックマークとして移動を試みる
  const bookmarkRes = await client.api.bookmarks[':id'].$patch({
    param: { id },
    json: { folderPath: newPath },
  });

  if (bookmarkRes.ok) {
    const updated = await bookmarkRes.json();
    if (options.json) {
      console.log(JSON.stringify(updated, null, 2));
    } else {
      console.log(`Moved bookmark to ${newPath}`);
    }
    return;
  }

  // ブックマークとして見つからなかった場合、フォルダとして移動を試みる
  // newPath から parentPath と name を算出
  const segments = newPath.split('/').filter(Boolean);
  const name = segments[segments.length - 1];
  const parentPath = segments.length <= 1 ? null : '/' + segments.slice(0, -1).join('/');

  const folderRes = await client.api.folders[':id'].$patch({
    param: { id },
    json: { name, parentPath },
  });

  if (folderRes.ok) {
    const updated = await folderRes.json();
    if (options.json) {
      console.log(JSON.stringify(updated, null, 2));
    } else {
      console.log(`Moved folder to ${updated.path}`);
    }
    return;
  }

  const body = await folderRes.json().catch(() => ({}));
  console.error('Move failed:', (body as { error?: string }).error ?? 'Item not found');
  process.exit(1);
}
