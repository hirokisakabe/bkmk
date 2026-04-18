import { createClient } from '../client.js';

interface MkdirOptions {
  json?: boolean;
}

export async function mkdirCommand(folderPath: string, options: MkdirOptions): Promise<void> {
  const client = createClient();

  const res = await client.api.folders.$post({
    json: { path: folderPath },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error('Failed to create folder:', (body as { error?: string }).error ?? res.statusText);
    process.exit(1);
  }

  const folder = await res.json();

  if (options.json) {
    console.log(JSON.stringify(folder, null, 2));
  } else {
    console.log(`Created: ${folder.path}`);
  }
}
