type OgpMetadata = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  faviconUrl: string | null;
};

const MAX_HTML_BYTES = 512 * 1024; // 512KB

function extractMetaContent(html: string, property: string): string | null {
  // Match both property="og:..." and name="og:..."
  const regex = new RegExp(
    `<meta\\s+(?:[^>]*?(?:property|name)=["']${property}["'][^>]*?content=["']([^"']*?)["']|[^>]*?content=["']([^"']*?)["'][^>]*?(?:property|name)=["']${property}["'])`,
    'i',
  );
  const match = html.match(regex);
  return match?.[1] ?? match?.[2] ?? null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1]?.trim() ?? null;
}

function resolveFaviconUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  return `${url.origin}/favicon.ico`;
}

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

export async function fetchOgpMetadata(targetUrl: string): Promise<OgpMetadata> {
  const empty: OgpMetadata = { title: null, description: null, imageUrl: null, faviconUrl: null };

  if (!validateFetchUrl(targetUrl)) {
    return empty;
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'bot',
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

    const ogTitle = extractMetaContent(html, 'og:title');
    const ogDescription = extractMetaContent(html, 'og:description');
    const ogImage = extractMetaContent(html, 'og:image');

    const title = ogTitle ?? extractTitle(html);
    const description = ogDescription ?? extractMetaContent(html, 'description');
    const faviconUrl = resolveFaviconUrl(targetUrl);

    return {
      title: title ?? null,
      description: description ?? null,
      imageUrl: ogImage ?? null,
      faviconUrl,
    };
  } catch {
    return empty;
  }
}
