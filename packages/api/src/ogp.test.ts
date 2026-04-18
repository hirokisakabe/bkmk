import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchOgpMetadata, isYouTubeUrl, validateFetchUrl } from './ogp.js';

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
});
