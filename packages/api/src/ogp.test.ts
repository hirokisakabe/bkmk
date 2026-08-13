import type { LookupAddress } from 'node:dns';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type PinnedLookup = (
  hostname: string,
  options: { all?: boolean },
  callback: (
    error: NodeJS.ErrnoException | null,
    address: string | LookupAddress[],
    family?: number,
  ) => void,
) => void;

const { agentState, lookupMock } = vi.hoisted(() => ({
  agentState: {
    closeMock: vi.fn<() => Promise<void>>(),
    lookups: [] as PinnedLookup[],
  },
  lookupMock:
    vi.fn<(hostname: string, options: { all: true; verbatim: true }) => Promise<LookupAddress[]>>(),
}));

vi.mock('node:dns/promises', () => ({ lookup: lookupMock }));
vi.mock('undici', async (importOriginal) => {
  const actual = await importOriginal<typeof import('undici')>();

  return {
    ...actual,
    Agent: class {
      constructor(options: { connect: { lookup: PinnedLookup } }) {
        agentState.lookups.push(options.connect.lookup);
      }

      close = agentState.closeMock;
    },
  };
});

import { fetchOgpMetadata, isTweetUrl, isYouTubeUrl, validateFetchUrl } from './ogp.js';

function chunkedHtmlResponse(chunks: Uint8Array[], contentType = 'text/html'): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    { headers: { 'content-type': contentType } },
  );
}

beforeEach(() => {
  lookupMock.mockReset();
  lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  agentState.closeMock.mockReset();
  agentState.closeMock.mockResolvedValue();
  agentState.lookups.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('validateFetchUrl', () => {
  it('有効なhttps URLを許可する', () => {
    expect(validateFetchUrl('https://example.com')).toBe(true);
  });

  it('有効なhttp URLを許可する', () => {
    expect(validateFetchUrl('http://example.com')).toBe(true);
  });

  it('localhostを拒否する', () => {
    expect(validateFetchUrl('http://localhost:3000')).toBe(false);
  });

  it.each([
    'http://127.0.0.1',
    'http://127.1.2.3',
    'http://127.255.255.254',
    'http://[::1]',
    'http://[::ffff:7f00:1]',
  ])('loopback variant %s を拒否する', (url) => {
    expect(validateFetchUrl(url)).toBe(false);
  });

  it.each([
    'http://0.0.0.0',
    'http://10.0.0.1',
    'http://100.64.0.1',
    'http://169.254.0.1',
    'http://172.16.0.1',
    'http://192.168.1.1',
    'http://224.0.0.1',
    'http://[::]',
    'http://[fc00::1]',
    'http://[fd12:3456::1]',
    'http://[fe80::1]',
    'http://[fec0::1]',
    'http://[ff02::1]',
    'http://[100:0:0:1::1]',
    'http://[3ffe::1]',
    'http://[4000::1]',
    'http://[::ffff:0808:0808]',
  ])('non-public address %s を拒否する', (url) => {
    expect(validateFetchUrl(url)).toBe(false);
  });

  it.each(['http://8.8.8.8', 'https://[2606:4700:4700::1111]'])('%s を許可する', (url) => {
    expect(validateFetchUrl(url)).toBe(true);
  });

  it('ftp:// スキームを拒否する', () => {
    expect(validateFetchUrl('ftp://example.com')).toBe(false);
  });

  it('file:// スキームを拒否する', () => {
    expect(validateFetchUrl('file:///etc/passwd')).toBe(false);
  });
});

describe('isYouTubeUrl', () => {
  it('youtube.com/watch のURLを判定する', () => {
    expect(isYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
  });

  it('www なしの youtube.com/watch を判定する', () => {
    expect(isYouTubeUrl('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
  });

  it('youtu.be のURLを判定する', () => {
    expect(isYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
  });

  it('YouTube以外のURLはfalseを返す', () => {
    expect(isYouTubeUrl('https://example.com')).toBe(false);
  });

  it('youtube.com の watch 以外のパスはfalseを返す', () => {
    expect(isYouTubeUrl('https://www.youtube.com/channel/UCxxxx')).toBe(false);
  });

  it('不正なURLはfalseを返す', () => {
    expect(isYouTubeUrl('not-a-url')).toBe(false);
  });
});

describe('isTweetUrl', () => {
  it('x.com のツイートURLを判定する', () => {
    expect(isTweetUrl('https://x.com/user/status/1234567890')).toBe(true);
  });

  it('www.x.com のツイートURLを判定する', () => {
    expect(isTweetUrl('https://www.x.com/user/status/1234567890')).toBe(true);
  });

  it('twitter.com のツイートURLを判定する', () => {
    expect(isTweetUrl('https://twitter.com/user/status/1234567890')).toBe(true);
  });

  it('www.twitter.com のツイートURLを判定する', () => {
    expect(isTweetUrl('https://www.twitter.com/user/status/1234567890')).toBe(true);
  });

  it('ツイート以外のx.com URLはfalseを返す', () => {
    expect(isTweetUrl('https://x.com/user')).toBe(false);
  });

  it('ツイート以外のtwitter.com URLはfalseを返す', () => {
    expect(isTweetUrl('https://twitter.com/settings')).toBe(false);
  });

  it('他のドメインはfalseを返す', () => {
    expect(isTweetUrl('https://example.com/user/status/123')).toBe(false);
  });

  it('不正なURLはfalseを返す', () => {
    expect(isTweetUrl('not-a-url')).toBe(false);
  });
});

describe('fetchOgpMetadata', () => {
  it('不正なURLの場合は空のメタデータを返す', async () => {
    const result = await fetchOgpMetadata('http://localhost:3000');
    expect(result).toEqual({
      title: null,
      description: null,
      imageUrl: null,
      faviconUrl: null,
    });
  });

  it('DNS結果にprivate IPが1件でも含まれるホストは取得しない', async () => {
    lookupMock.mockResolvedValueOnce([
      { address: '93.184.216.34', family: 4 },
      { address: '192.168.1.20', family: 4 },
    ]);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(fetchOgpMetadata('https://attacker.example/page')).resolves.toEqual({
      title: null,
      description: null,
      imageUrl: null,
      faviconUrl: null,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('DNSをall:true, verbatim:trueで引き、検証済みIPをAgent lookupへ固定する', async () => {
    const addresses: LookupAddress[] = [
      { address: '93.184.216.34', family: 4 },
      { address: '2606:4700:4700::1111', family: 6 },
    ];
    lookupMock.mockResolvedValueOnce(addresses);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response('<title>Safe</title>', { headers: { 'content-type': 'text/html' } }),
      );

    await fetchOgpMetadata('https://safe.example/page');

    expect(lookupMock).toHaveBeenCalledWith('safe.example', { all: true, verbatim: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL('https://safe.example/page'),
      expect.objectContaining({ redirect: 'manual', dispatcher: expect.anything() }),
    );
    expect(agentState.lookups).toHaveLength(1);

    const allCallback = vi.fn();
    agentState.lookups[0]('safe.example', { all: true }, allCallback);
    expect(allCallback).toHaveBeenCalledWith(null, addresses);

    const singleCallback = vi.fn();
    agentState.lookups[0]('safe.example', {}, singleCallback);
    expect(singleCallback).toHaveBeenCalledWith(null, '93.184.216.34', 4);
  });

  it('DNS lookupがdeadlineを超えたら後着結果を待たずに取得を中止する', async () => {
    const controller = new AbortController();
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    lookupMock.mockReturnValueOnce(new Promise(() => undefined));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const resultPromise = fetchOgpMetadata('https://slow-dns.example/page');
    await vi.waitFor(() => expect(lookupMock).toHaveBeenCalledOnce());
    controller.abort(new DOMException('deadline exceeded', 'TimeoutError'));

    await expect(resultPromise).resolves.toEqual({
      title: null,
      description: null,
      imageUrl: null,
      faviconUrl: null,
    });
    expect(timeoutSpy).toHaveBeenCalledWith(10_000);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('public URLからprivate URLへのredirectを追跡しない', async () => {
    lookupMock
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValueOnce([{ address: '10.0.0.5', family: 4 }]);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: 'http://internal.example/admin' },
      }),
    );

    await expect(fetchOgpMetadata('https://public.example/page')).resolves.toEqual({
      title: null,
      description: null,
      imageUrl: null,
      faviconUrl: null,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('redirectごとに移動先hostを再検証する', async () => {
    lookupMock
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValueOnce([{ address: '93.184.216.35', family: 4 }]);
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'https://redirected.example/next' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('<title>Redirected</title>', { headers: { 'content-type': 'text/html' } }),
      );

    await fetchOgpMetadata('https://original.example/start');

    expect(lookupMock).toHaveBeenNthCalledWith(1, 'original.example', {
      all: true,
      verbatim: true,
    });
    expect(lookupMock).toHaveBeenNthCalledWith(2, 'redirected.example', {
      all: true,
      verbatim: true,
    });
  });

  it.each([
    ['Location欠落', undefined],
    ['不正なLocation', 'http://[:::]'],
  ])('%sのredirectを拒否する', async (_label, location) => {
    const headers = location ? { location } : undefined;
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 302, headers }));

    await expect(fetchOgpMetadata('https://example.com/start')).resolves.toEqual({
      title: null,
      description: null,
      imageUrl: null,
      faviconUrl: null,
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('redirect上限を超えたら拒否する', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    for (let index = 0; index < 6; index += 1) {
      fetchSpy.mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: `/redirect-${index + 1}` },
        }),
      );
    }

    await expect(fetchOgpMetadata('https://example.com/start')).resolves.toEqual({
      title: null,
      description: null,
      imageUrl: null,
      faviconUrl: null,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(6);
  });

  it('OGPメタデータを正しく抽出する', async () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Test Title" />
          <meta property="og:description" content="Test Description" />
          <meta property="og:image" content="https://example.com/image.jpg" />
          <title>Fallback Title</title>
        </head>
        <body></body>
      </html>
    `;

    const mockResponse = new Response(html, {
      headers: { 'content-type': 'text/html' },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse);

    const result = await fetchOgpMetadata('https://example.com');
    expect(result).toEqual({
      title: 'Test Title',
      description: 'Test Description',
      imageUrl: 'https://example.com/image.jpg',
      faviconUrl: 'https://example.com/favicon.ico',
    });
  });

  it('OGPがない場合はtitleタグからフォールバックする', async () => {
    const html = `
      <html>
        <head>
          <title>Page Title</title>
          <meta name="description" content="Page Description" />
        </head>
        <body></body>
      </html>
    `;

    const mockResponse = new Response(html, {
      headers: { 'content-type': 'text/html' },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse);

    const result = await fetchOgpMetadata('https://example.com');
    expect(result.title).toBe('Page Title');
    expect(result.description).toBe('Page Description');
  });

  it('属性順・引用符・HTMLエンティティの揺れをHTMLパーサーで処理する', async () => {
    const html = `
      <html>
        <head>
          <meta content='OG &amp; Title' property='og:title'>
          <meta content='Fish &amp; Chips' property='og:description'>
          <meta content='/images/cover.jpg?size=large&amp;format=webp' property='og:image'>
          <link href='../icons/site.ico?theme=light&amp;v=2' rel='shortcut ICON'>
        </head>
      </html>
    `;
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: '/articles/redirected/page' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(html, {
          headers: { 'content-type': 'text/html' },
        }),
      );

    await expect(fetchOgpMetadata('https://example.com/articles/original')).resolves.toEqual({
      title: 'OG & Title',
      description: 'Fish & Chips',
      imageUrl: 'https://example.com/images/cover.jpg?size=large&format=webp',
      faviconUrl: 'https://example.com/articles/icons/site.ico?theme=light&v=2',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('OGPをTwitter CardとHTMLより優先する', async () => {
    const html = `
      <html>
        <head>
          <title>HTML Title</title>
          <meta name="description" content="HTML Description">
          <meta name="twitter:title" content="Twitter Title">
          <meta name="twitter:description" content="Twitter Description">
          <meta name="twitter:image" content="https://example.com/twitter.jpg">
          <meta property="og:title" content="OG Title">
          <meta property="og:description" content="OG Description">
          <meta property="og:image" content="https://example.com/og.jpg">
        </head>
      </html>
    `;
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(html, { headers: { 'content-type': 'text/html' } }),
    );

    await expect(fetchOgpMetadata('https://example.com')).resolves.toMatchObject({
      title: 'OG Title',
      description: 'OG Description',
      imageUrl: 'https://example.com/og.jpg',
    });
  });

  it('secure URL、URL、通常OGPの順で複数画像から選択する', async () => {
    const html = `
      <meta property="og:image" content="https://example.com/plain-first.jpg">
      <meta property="og:image" content="https://example.com/plain-second.jpg">
      <meta property="og:image:url" content="https://example.com/url.jpg">
      <meta property="og:image:secure_url" content="https://example.com/secure.jpg">
    `;
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(html, { headers: { 'content-type': 'text/html' } }),
    );

    const result = await fetchOgpMetadata('https://example.com');
    expect(result.imageUrl).toBe('https://example.com/secure.jpg');
  });

  it('secure URLがない場合はog:image:urlを優先する', async () => {
    const html = `
      <meta property="og:image" content="https://example.com/plain.jpg">
      <meta property="og:image:url" content="https://example.com/url.jpg">
    `;
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(html, { headers: { 'content-type': 'text/html' } }),
    );

    const result = await fetchOgpMetadata('https://example.com');
    expect(result.imageUrl).toBe('https://example.com/url.jpg');
  });

  it('secure URLとurlがない場合は最初のog:imageを使う', async () => {
    const html = `
      <meta property="og:image" content="https://example.com/plain-first.jpg">
      <meta property="og:image" content="https://example.com/plain-second.jpg">
    `;
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(html, { headers: { 'content-type': 'text/html' } }),
    );

    const result = await fetchOgpMetadata('https://example.com');
    expect(result.imageUrl).toBe('https://example.com/plain-first.jpg');
  });

  it('OGPがない場合はTwitter Cardへフォールバックする', async () => {
    const html = `
      <title>HTML Title</title>
      <meta name="description" content="HTML Description">
      <meta name="twitter:title" content="Twitter Title">
      <meta name="twitter:description" content="Twitter Description">
      <meta name="twitter:image" content="/twitter.jpg">
    `;
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(html, { headers: { 'content-type': 'text/html' } }),
    );

    await expect(fetchOgpMetadata('https://example.com/posts/1')).resolves.toMatchObject({
      title: 'Twitter Title',
      description: 'Twitter Description',
      imageUrl: 'https://example.com/twitter.jpg',
    });
  });

  it('meta画像がない場合はJSON-LD画像へフォールバックする', async () => {
    const html = `
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","image":{"url":"/json-ld.jpg"}}
      </script>
    `;
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(html, { headers: { 'content-type': 'text/html' } }),
    );

    const result = await fetchOgpMetadata('https://example.com/posts/1');
    expect(result.imageUrl).toBe('https://example.com/json-ld.jpg');
  });

  it('構造化画像がない場合は本文画像へフォールバックする', async () => {
    const html = '<article><img src="images/article.jpg" alt="Article image"></article>';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(html, { headers: { 'content-type': 'text/html' } }),
    );

    const result = await fetchOgpMetadata('https://example.com/posts/1');
    expect(result.imageUrl).toBe('https://example.com/posts/images/article.jpg');
  });

  it('base hrefを画像とfaviconの相対URL解決に使う', async () => {
    const html = `
      <base href="https://cdn.example.com/assets/">
      <meta property="og:image" content="images/cover.jpg">
      <link rel="icon" href="icons/site.ico">
    `;
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(html, { headers: { 'content-type': 'text/html' } }),
    );

    await expect(fetchOgpMetadata('https://example.com/posts/1')).resolves.toMatchObject({
      imageUrl: 'https://cdn.example.com/assets/images/cover.jpg',
      faviconUrl: 'https://cdn.example.com/assets/icons/site.ico',
    });
  });

  it('icon linkがない場合は最終URLのorigin直下へフォールバックする', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'https://redirected.example.com/path/page' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('<title>Redirected</title>', {
          headers: { 'content-type': 'text/html' },
        }),
      );

    const result = await fetchOgpMetadata('https://example.com/original');
    expect(result.faviconUrl).toBe('https://redirected.example.com/favicon.ico');
  });

  it('上限を超える単一chunkをHTMLへ追加しない', async () => {
    const oversizedHtml = `<title>Must not be parsed</title>${'x'.repeat(512 * 1024)}`;
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(oversizedHtml, { headers: { 'content-type': 'text/html' } }),
    );

    await expect(fetchOgpMetadata('https://example.com')).resolves.toEqual({
      title: null,
      description: null,
      imageUrl: null,
      faviconUrl: null,
    });
  });

  it('512KBちょうどでEOFならHTMLを許可する', async () => {
    const encoder = new TextEncoder();
    const title = '<title>Exact limit</title>';
    const padding = 'x'.repeat(512 * 1024 - encoder.encode(title).byteLength);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      chunkedHtmlResponse([encoder.encode(title + padding)]),
    );

    await expect(fetchOgpMetadata('https://example.com')).resolves.toMatchObject({
      title: 'Exact limit',
    });
  });

  it('512KBちょうどの後に追加chunkがあれば拒否する', async () => {
    const encoder = new TextEncoder();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      chunkedHtmlResponse([encoder.encode('x'.repeat(512 * 1024)), encoder.encode('!')]),
    );

    await expect(fetchOgpMetadata('https://example.com')).resolves.toEqual({
      title: null,
      description: null,
      imageUrl: null,
      faviconUrl: null,
    });
  });

  it('fetchが失敗した場合は空のメタデータを返す', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchOgpMetadata('https://example.com');
    expect(result).toEqual({
      title: null,
      description: null,
      imageUrl: null,
      faviconUrl: null,
    });
  });

  it('HTMLでないレスポンスの場合は空のメタデータを返す', async () => {
    const mockResponse = new Response('{}', {
      headers: { 'content-type': 'application/json' },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse);

    const result = await fetchOgpMetadata('https://example.com/api');
    expect(result).toEqual({
      title: null,
      description: null,
      imageUrl: null,
      faviconUrl: null,
    });
  });

  it('Content-Typeをcase-insensitiveに判定する', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('<title>Mixed case MIME</title>', {
        headers: { 'content-type': 'Text/HTML; Charset=UTF-8' },
      }),
    );

    await expect(fetchOgpMetadata('https://example.com')).resolves.toMatchObject({
      title: 'Mixed case MIME',
    });
  });

  it('YouTube URLの場合はoEmbed APIからメタデータを取得する', async () => {
    const oembedResponse = {
      title: 'YouTube Video Title',
      thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(oembedResponse), {
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await fetchOgpMetadata('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result).toEqual({
      title: 'YouTube Video Title',
      description: null,
      imageUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      faviconUrl: 'https://www.youtube.com/favicon.ico',
    });
  });

  it('youtu.be URLの場合はoEmbed APIからメタデータを取得する', async () => {
    const oembedResponse = {
      title: 'Short URL Video',
      thumbnail_url: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(oembedResponse), {
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await fetchOgpMetadata('https://youtu.be/abc123');
    expect(result).toEqual({
      title: 'Short URL Video',
      description: null,
      imageUrl: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
      faviconUrl: 'https://www.youtube.com/favicon.ico',
    });
  });

  it('YouTube oEmbed APIが失敗した場合は通常のOGP取得にフォールバックする', async () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Fallback Title" />
          <meta property="og:description" content="Fallback Description" />
          <meta property="og:image" content="https://example.com/fallback.jpg" />
        </head>
        <body></body>
      </html>
    `;

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(html, {
          headers: { 'content-type': 'text/html' },
        }),
      );

    const result = await fetchOgpMetadata('https://www.youtube.com/watch?v=invalid');
    expect(result).toEqual({
      title: 'Fallback Title',
      description: 'Fallback Description',
      imageUrl: 'https://example.com/fallback.jpg',
      faviconUrl: 'https://www.youtube.com/favicon.ico',
    });
  });

  it('YouTube oEmbed APIがエラーの場合は通常のOGP取得にフォールバックする', async () => {
    const html = `
      <html>
        <head><title>YouTube</title></head>
        <body></body>
      </html>
    `;

    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(
        new Response(html, {
          headers: { 'content-type': 'text/html' },
        }),
      );

    const result = await fetchOgpMetadata('https://www.youtube.com/watch?v=xxx');
    expect(result).toEqual({
      title: 'YouTube',
      description: null,
      imageUrl: null,
      faviconUrl: 'https://www.youtube.com/favicon.ico',
    });
  });

  it('Twitter URLの場合はFxTwitter APIからメタデータを取得する', async () => {
    const fxResponse = {
      code: 200,
      message: 'OK',
      tweet: {
        text: 'これはテストツイートです',
        author: { name: 'Test User', avatar_url: 'https://pbs.twimg.com/profile/test.jpg' },
        media: {
          photos: [
            {
              type: 'photo',
              url: 'https://pbs.twimg.com/media/test123.jpg',
              width: 1200,
              height: 800,
            },
          ],
        },
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(fxResponse), {
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await fetchOgpMetadata('https://x.com/testuser/status/123');
    expect(result).toEqual({
      title: 'Test User',
      description: 'これはテストツイートです',
      imageUrl: 'https://pbs.twimg.com/media/test123.jpg',
      faviconUrl: 'https://x.com/favicon.ico',
    });
  });

  it('twitter.com URLの場合もFxTwitter APIからメタデータを取得する', async () => {
    const fxResponse = {
      code: 200,
      message: 'OK',
      tweet: {
        text: 'Hello world!',
        author: { name: 'Another User', avatar_url: 'https://pbs.twimg.com/profile/another.jpg' },
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(fxResponse), {
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await fetchOgpMetadata('https://twitter.com/another/status/456');
    expect(result).toEqual({
      title: 'Another User',
      description: 'Hello world!',
      imageUrl: 'https://pbs.twimg.com/profile/another.jpg',
      faviconUrl: 'https://x.com/favicon.ico',
    });
  });

  it('画像なし・アバターなしのツイートではimageUrlがnullになる', async () => {
    const fxResponse = {
      code: 200,
      message: 'OK',
      tweet: {
        text: 'No media tweet',
        author: { name: 'No Avatar User' },
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(fxResponse), {
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await fetchOgpMetadata('https://x.com/noavatar/status/789');
    expect(result).toEqual({
      title: 'No Avatar User',
      description: 'No media tweet',
      imageUrl: null,
      faviconUrl: 'https://x.com/favicon.ico',
    });
  });

  it('FxTwitter APIが失敗した場合は通常のOGP取得にフォールバックする', async () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Fallback Tweet" />
          <meta property="og:description" content="Fallback Description" />
        </head>
        <body></body>
      </html>
    `;

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(html, {
          headers: { 'content-type': 'text/html' },
        }),
      );

    const result = await fetchOgpMetadata('https://x.com/user/status/999');
    expect(result).toEqual({
      title: 'Fallback Tweet',
      description: 'Fallback Description',
      imageUrl: null,
      faviconUrl: 'https://x.com/favicon.ico',
    });
  });

  it('FxTwitter APIがエラーの場合は通常のOGP取得にフォールバックする', async () => {
    const html = `
      <html>
        <head><title>X</title></head>
        <body></body>
      </html>
    `;

    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(
        new Response(html, {
          headers: { 'content-type': 'text/html' },
        }),
      );

    const result = await fetchOgpMetadata('https://x.com/user/status/999');
    expect(result).toEqual({
      title: 'X',
      description: null,
      imageUrl: null,
      faviconUrl: 'https://x.com/favicon.ico',
    });
  });
});
