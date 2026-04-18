import { createClient } from '../client.js';

interface AddOptions {
  folder?: string;
  json?: boolean;
}

export async function addCommand(url: string, options: AddOptions): Promise<void> {
  const client = createClient();

  const res = await client.api.bookmarks.$post({
    json: {
      url,
      folderPath: options.folder ?? null,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error('Failed to add bookmark:', (body as { error?: string }).error ?? res.statusText);
    process.exit(1);
  }

  const bookmark = await res.json();

  if (options.json) {
    console.log(JSON.stringify(bookmark, null, 2));
  } else {
    console.log(`Added: ${bookmark.title ?? bookmark.url}`);
    console.log(`  ID:  ${bookmark.id}`);
    console.log(`  URL: ${bookmark.url}`);
    if (bookmark.folderPath) {
      console.log(`  Folder: ${bookmark.folderPath}`);
    }
  }
}
