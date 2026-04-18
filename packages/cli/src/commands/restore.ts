import { createClient } from '../client.js';

interface RestoreOptions {
  json?: boolean;
}

export async function restoreCommand(id: string, options: RestoreOptions): Promise<void> {
  const client = createClient();

  const res = await client.api.trash[':id'].restore.$post({
    param: { id },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error('Restore failed:', (body as { error?: string }).error ?? res.statusText);
    process.exit(1);
  }

  const result = await res.json();

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('Restored successfully.');
  }
}
