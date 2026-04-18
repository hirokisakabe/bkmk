import { createClient } from '../client.js';

interface LsOptions {
  deep?: boolean;
  json?: boolean;
}

export async function lsCommand(folderPath: string | undefined, options: LsOptions): Promise<void> {
  const client = createClient();

  const query: Record<string, string> = {};
  if (folderPath) {
    query.folder = folderPath;
    query.parent = folderPath;
  }
  if (options.deep) {
    query.deep = 'true';
  }

  const [foldersRes, bookmarksRes] = await Promise.all([
    client.api.folders.$get({
      query: { parent: folderPath },
    }),
    client.api.bookmarks.$get({
      query: {
        folder: folderPath,
        deep: options.deep ? 'true' : undefined,
      },
    }),
  ]);

  if (!foldersRes.ok || !bookmarksRes.ok) {
    console.error('Failed to fetch items');
    process.exit(1);
  }

  const foldersList = await foldersRes.json();
  const bookmarksList = await bookmarksRes.json();

  if (options.json) {
    console.log(JSON.stringify({ folders: foldersList, bookmarks: bookmarksList }, null, 2));
    return;
  }

  if (foldersList.length === 0 && bookmarksList.length === 0) {
    console.log('(empty)');
    return;
  }

  for (const folder of foldersList) {
    console.log(`  ${folder.path}/`);
  }

  for (const bookmark of bookmarksList) {
    const title = bookmark.title ?? bookmark.url;
    console.log(`  ${bookmark.id}  ${title}`);
    console.log(`             ${bookmark.url}`);
  }
}
