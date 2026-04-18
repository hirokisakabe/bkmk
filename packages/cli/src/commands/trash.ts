import { createClient } from '../client.js';

interface TrashOptions {
  json?: boolean;
}

export async function trashCommand(options: TrashOptions): Promise<void> {
  const client = createClient();

  const res = await client.api.trash.$get();

  if (!res.ok) {
    console.error('Failed to fetch trash');
    process.exit(1);
  }

  const { folders, bookmarks } = await res.json();

  if (options.json) {
    console.log(JSON.stringify({ folders, bookmarks }, null, 2));
    return;
  }

  if (folders.length === 0 && bookmarks.length === 0) {
    console.log('Trash is empty.');
    return;
  }

  if (folders.length > 0) {
    console.log('Folders:');
    for (const folder of folders) {
      console.log(`  ${folder.id}  ${folder.path}/`);
    }
  }

  if (bookmarks.length > 0) {
    console.log('Bookmarks:');
    for (const bookmark of bookmarks) {
      const title = bookmark.title ?? bookmark.url;
      console.log(`  ${bookmark.id}  ${title}`);
      console.log(`             ${bookmark.url}`);
    }
  }
}
