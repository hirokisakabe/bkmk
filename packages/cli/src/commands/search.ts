import { createClient } from '../client.js';

interface SearchOptions {
  json?: boolean;
}

export async function searchCommand(keyword: string, options: SearchOptions): Promise<void> {
  const client = createClient();

  const res = await client.api.search.$get({
    query: { q: keyword },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error('Search failed:', (body as { error?: string }).error ?? res.statusText);
    process.exit(1);
  }

  const results = await res.json();

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (results.length === 0) {
    console.log('No results found.');
    return;
  }

  for (const item of results) {
    const title = item.title ?? item.url;
    const folder = item.folderPath ?? '/';
    console.log(`  ${item.id}  ${title}`);
    console.log(`             ${item.url}  [${folder}]`);
  }
}
