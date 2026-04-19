import { createClient } from '../client.js';

interface MvOptions {
  json?: boolean;
}

export async function mvCommand(id: string, newPath: string, options: MvOptions): Promise<void> {
  const client = createClient();

  // 末尾スラッシュを正規化（例: "/foo/" → "/foo"）
  newPath = newPath.replace(/\/+$/, '') || '/';

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
  // newPath を移動先の親パスとして扱う（フォルダ名は保持）
  const parentPath = newPath === '/' ? null : newPath;

  const folderRes = await client.api.folders[':id'].$patch({
    param: { id },
    json: { parentPath },
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
