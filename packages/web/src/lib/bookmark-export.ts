import { client } from './api-client';

const FALLBACK_FILENAME = 'bkmk-export.csv';

function filenameFromDisposition(disposition: string | null): string {
  const match = disposition?.match(/filename="([^"]+)"/);
  return match?.[1] ?? FALLBACK_FILENAME;
}

export async function downloadBookmarkExport(): Promise<void> {
  const response = await client.api.export.bookmarks.$get();
  if (!response.ok) {
    throw new Error('エクスポートに失敗しました');
  }

  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filenameFromDisposition(response.headers.get('content-disposition'));
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
