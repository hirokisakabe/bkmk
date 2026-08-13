import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchOgpMetadata, isTweetUrl, isYouTubeUrl, validateFetchUrl } from './ogp.js';

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

  it('127.0.0.1を拒否する', () => {
    expect(validateFetchUrl('http://127.0.0.1')).toBe(false);
  });

  // Note: IPv6 loopback [::1] は現在の実装ではブラケット付きのため
  // hostname が "[::1]" となりチェックを通過してしまう（既知の制限）

  it('プライベートIP(10.x)を拒否する', () => {
    expect(validateFetchUrl('http://10.0.0.1')).toBe(false);
  });

  it('プライベートIP(172.16.x)を拒否する', () => {
    expect(validateFetchUrl('http://172.16.0.1')).toBe(false);
  });

  it('プライベートIP(192.168.x)を拒否する', () => {
    expect(validateFetchUrl('http://192.168.1.1')).toBe(false);
  });

  it('リンクローカルアドレスを拒否する', () => {
    expect(validateFetchUrl('http://169.254.0.1')).toBe(false);
  });

  it('0.0.0.0を拒否する', () => {
    expect(validateFetchUrl('http://0.0.0.0')).toBe(false);
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
    const mockResponse = new Response(html, {
      headers: { 'content-type': 'text/html' },
    });
    Object.defineProperty(mockResponse, 'url', {
      value: 'https://example.com/articles/redirected/page',
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse);

    await expect(fetchOgpMetadata('https://example.com/articles/original')).resolves.toEqual({
      title: 'OG & Title',
      description: 'Fish & Chips',
      imageUrl: 'https://example.com/images/cover.jpg?size=large&format=webp',
      faviconUrl: 'https://example.com/articles/icons/site.ico?theme=light&v=2',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
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

  it('icon linkがない場合は最終URLのorigin直下へフォールバックする', async () => {
    const mockResponse = new Response('<title>Redirected</title>', {
      headers: { 'content-type': 'text/html' },
    });
    Object.defineProperty(mockResponse, 'url', {
      value: 'https://redirected.example.com/path/page',
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse);

    const result = await fetchOgpMetadata('https://example.com/original');
    expect(result.faviconUrl).toBe('https://redirected.example.com/favicon.ico');
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
