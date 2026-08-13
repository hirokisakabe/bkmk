import createMetascraper from 'metascraper';
import descriptionRules from 'metascraper-description';
import imageRules from 'metascraper-image';
import titleRules from 'metascraper-title';

type OgpMetadata = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  faviconUrl: string | null;
};

const MAX_HTML_BYTES = 512 * 1024; // 512KB

function resolveHttpUrl(value: string, baseUrl: string): string | null {
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

const faviconRules: createMetascraper.Rules = {
  favicon: [
    ({ htmlDom, url }) => {
      let faviconUrl: string | undefined;

      htmlDom('link[rel][href]').each((_index, element) => {
        const link = htmlDom(element);
        const relValues = (link.attr('rel') ?? '').toLowerCase().split(/\s+/);
        if (!relValues.includes('icon')) return;

        const href = link.attr('href');
        if (!href) return;

        const resolved = resolveHttpUrl(href, url);
        if (resolved) {
          faviconUrl = resolved;
          return false;
        }
      });

      return faviconUrl;
    },
  ],
};

const scrapeMetadata = createMetascraper([
  titleRules(),
  descriptionRules(),
  imageRules(),
  faviconRules,
]);

/**
 * URL のスキームが http/https であり、プライベートアドレスでないことを検証する。
 */
export function validateFetchUrl(targetUrl: string): boolean {
  const url = new URL(targetUrl);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }

  const hostname = url.hostname.toLowerCase();

  // localhost / loopback
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return false;
  }

  // プライベート IP レンジ / リンクローカル / メタデータエンドポイント
  const privatePatterns = [
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
    /^192\.168\.\d{1,3}\.\d{1,3}$/,
    /^169\.254\.\d{1,3}\.\d{1,3}$/,
    /^0\.0\.0\.0$/,
  ];

  for (const pattern of privatePatterns) {
    if (pattern.test(hostname)) {
      return false;
    }
  }

  return true;
}

async function readLimitedBody(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const decoder = new TextDecoder();
  let result = '';
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.byteLength;
    result += decoder.decode(value, { stream: true });

    if (totalBytes >= MAX_HTML_BYTES) {
      await reader.cancel();
      break;
    }
  }

  return result;
}

export function isYouTubeUrl(targetUrl: string): boolean {
  try {
    const url = new URL(targetUrl);
    const hostname = url.hostname.toLowerCase();
    return (
      ((hostname === 'www.youtube.com' || hostname === 'youtube.com') &&
        url.pathname === '/watch') ||
      hostname === 'youtu.be'
    );
  } catch {
    return false;
  }
}

async function fetchYouTubeOembedMetadata(targetUrl: string): Promise<OgpMetadata | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`;
    const response = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { title?: string; thumbnail_url?: string };

    return {
      title: data.title ?? null,
      description: null,
      imageUrl: data.thumbnail_url ?? null,
      faviconUrl: 'https://www.youtube.com/favicon.ico',
    };
  } catch {
    return null;
  }
}

export function isTweetUrl(targetUrl: string): boolean {
  try {
    const url = new URL(targetUrl);
    const hostname = url.hostname.toLowerCase();
    return (
      (hostname === 'x.com' ||
        hostname === 'www.x.com' ||
        hostname === 'twitter.com' ||
        hostname === 'www.twitter.com') &&
      /^\/[^/]+\/status\/\d+/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

async function fetchTweetMetadata(targetUrl: string): Promise<OgpMetadata | null> {
  try {
    const url = new URL(targetUrl);
    // pathname: /user/status/123 → FxTwitter API URL に変換
    const apiUrl = `https://api.fxtwitter.com${url.pathname}`;
    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      tweet?: {
        text?: string;
        author?: { name?: string; avatar_url?: string };
        media?: {
          photos?: { url: string }[];
        };
      };
    };

    return {
      title: data.tweet?.author?.name ?? null,
      description: data.tweet?.text ?? null,
      imageUrl: data.tweet?.media?.photos?.[0]?.url ?? data.tweet?.author?.avatar_url ?? null,
      faviconUrl: 'https://x.com/favicon.ico',
    };
  } catch {
    return null;
  }
}

export async function fetchOgpMetadata(targetUrl: string): Promise<OgpMetadata> {
  const empty: OgpMetadata = { title: null, description: null, imageUrl: null, faviconUrl: null };

  if (!validateFetchUrl(targetUrl)) {
    return empty;
  }

  if (isYouTubeUrl(targetUrl)) {
    const oembedResult = await fetchYouTubeOembedMetadata(targetUrl);
    if (oembedResult) {
      return oembedResult;
    }
  }

  if (isTweetUrl(targetUrl)) {
    const oembedResult = await fetchTweetMetadata(targetUrl);
    if (oembedResult) {
      return oembedResult;
    }
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'bkmk/1.0 (+https://github.com/hirokisakabe/bkmk)',
        Accept: 'text/html',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return empty;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return empty;
    }

    const html = await readLimitedBody(response);
    const pageUrl = response.url || targetUrl;
    const metadata = await scrapeMetadata({ html, url: pageUrl });

    return {
      title: metadata.title ?? null,
      description: metadata.description ?? null,
      imageUrl: metadata.image ? resolveHttpUrl(metadata.image, pageUrl) : null,
      faviconUrl: metadata.favicon ?? resolveHttpUrl('/favicon.ico', new URL(pageUrl).origin),
    };
  } catch {
    return empty;
  }
}
