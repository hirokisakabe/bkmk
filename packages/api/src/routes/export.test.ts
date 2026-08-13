import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestApp, mockQueryChain } from '../test/helpers.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { db } from '../db/index.js';
import { exportRoute } from './export.js';

const app = createTestApp('/api/export', exportRoute);
const header =
  'url,title,description,folder_path,image_url,favicon_url,position,created_at,updated_at\r\n';

afterEach(() => {
  vi.useRealTimers();
});

describe('GET /api/export/bookmarks', () => {
  it('BOM 付き UTF-8・CRLF・所定の列で CSV を返す', async () => {
    vi.mocked(db.select).mockReturnValue(
      mockQueryChain([
        {
          url: 'https://example.com/?q=日本語',
          title: '絵文字 🔖, title',
          description: 'first line\nsecond "line"',
          folderPath: '/work/project',
          imageUrl: 'https://example.com/image.png',
          faviconUrl: 'https://example.com/favicon.ico',
          position: 3,
          createdAt: new Date('2026-08-13T01:02:03.000Z'),
          updatedAt: new Date('2026-08-14T04:05:06.000Z'),
        },
      ]) as never,
    );

    const res = await app.request('/api/export/bookmarks');
    const bytes = new Uint8Array(await res.arrayBuffer());

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(bytes.slice(0, 3)).toEqual(new Uint8Array([0xef, 0xbb, 0xbf]));

    const csv = new TextDecoder().decode(bytes);
    expect(csv).toBe(
      `${header}https://example.com/?q=日本語,"絵文字 🔖, title","first line\nsecond ""line""",/work/project,https://example.com/image.png,https://example.com/favicon.ico,3,2026-08-13T01:02:03.000Z,2026-08-14T04:05:06.000Z\r\n`,
    );
    expect(csv.replaceAll('\r\n', '')).not.toContain('\n');
  });

  it.each(['=1+1', '+SUM(A1:A2)', '-2+3', '@command'])(
    '%s を数式として解釈されない形にする',
    async (title) => {
      vi.mocked(db.select).mockReturnValue(
        mockQueryChain([
          {
            url: 'https://example.com',
            title,
            description: null,
            folderPath: null,
            imageUrl: null,
            faviconUrl: null,
            position: 0,
            createdAt: new Date('2026-08-13T00:00:00.000Z'),
            updatedAt: new Date('2026-08-13T00:00:00.000Z'),
          },
        ]) as never,
      );

      const res = await app.request('/api/export/bookmarks');
      const csv = await res.text();
      const fields = csv.split('\r\n')[1].split(',');

      expect(fields[1]).toBe(`'${title}`);
      expect(fields[3]).toBe('');
    },
  );

  it('0 件でもヘッダー行だけを返す', async () => {
    vi.mocked(db.select).mockReturnValue(mockQueryChain([]) as never);

    const res = await app.request('/api/export/bookmarks');

    expect(await res.text()).toBe(header);
  });

  it('出力日を含むファイル名を返す', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T12:00:00.000Z'));
    vi.mocked(db.select).mockReturnValue(mockQueryChain([]) as never);

    const res = await app.request('/api/export/bookmarks');

    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="bkmk-export-2026-08-14.csv"',
    );
  });
});
