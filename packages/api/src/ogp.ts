import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

import createMetascraper from 'metascraper';
import descriptionRules from 'metascraper-description';
import imageRules from 'metascraper-image';
import titleRules from 'metascraper-title';
import { Agent, type Dispatcher } from 'undici';

type OgpMetadata = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  faviconUrl: string | null;
};

const MAX_HTML_BYTES = 512 * 1024; // 512KB
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 10_000;

const blockedIpv4Addresses = new BlockList();
const blockedIpv6Addresses = new BlockList();
const globalUnicastIpv6Addresses = new BlockList();

globalUnicastIpv6Addresses.addSubnet('2000::', 3, 'ipv6');

for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blockedIpv4Addresses.addSubnet(network, prefix, 'ipv4');
}

for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['::ffff:0:0', 96],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 32],
  ['2001:2::', 48],
  ['2001:10::', 28],
  ['2001:20::', 28],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3ffe::', 16],
  ['3fff::', 20],
  ['5f00::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blockedIpv6Addresses.addSubnet(network, prefix, 'ipv6');
}

function normalizeHostname(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

function isPublicIpAddress(address: string): boolean {
  const family = isIP(address);
  return (
    (family === 4 && !blockedIpv4Addresses.check(address, 'ipv4')) ||
    (family === 6 &&
      globalUnicastIpv6Addresses.check(address, 'ipv6') &&
      !blockedIpv6Addresses.check(address, 'ipv6'))
  );
}

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

const documentBaseRules: createMetascraper.Rules = {
  documentBaseUrl: [
    ({ htmlDom, url }) => {
      const href = htmlDom('base[href]').first().attr('href');
      return href ? resolveHttpUrl(href, url) : undefined;
    },
  ],
};

const scrapeDocumentBase = createMetascraper([documentBaseRules]);

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
  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    return false;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }

  const hostname = normalizeHostname(url.hostname.toLowerCase());

  // localhost / loopback
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return false;
  }

  return isIP(hostname) === 0 || isPublicIpAddress(hostname);
}

type ResolvedAddress = { address: string; family: 4 | 6 };

async function waitWithSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();

  return await new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });

    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

async function resolvePublicAddresses(url: URL, signal: AbortSignal): Promise<ResolvedAddress[]> {
  const hostname = normalizeHostname(url.hostname);
  const family = isIP(hostname);
  const addresses: ResolvedAddress[] = family
    ? [{ address: hostname, family: family as 4 | 6 }]
    : (await waitWithSignal(lookup(hostname, { all: true, verbatim: true }), signal)).flatMap(
        (resolved) =>
          resolved.family === 4 || resolved.family === 6 ? [resolved as ResolvedAddress] : [],
      );

  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new Error('URL hostname resolves to a non-public address');
  }

  return addresses;
}

/**
 * DNS 検証と接続の間で名前を再解決させないため、Undici の lookup を検証済み結果へ固定する。
 * ただし、public IP 上のサーバー自身が private network を代理取得する挙動までは検出できない。
 */
function createPinnedDispatcher(addresses: ResolvedAddress[]): Agent {
  return new Agent({
    connect: {
      lookup: (_hostname, options, callback) => {
        if (options.all) {
          callback(null, addresses);
          return;
        }

        const address = addresses[0];
        callback(null, address.address, address.family);
      },
    },
  });
}

type FetchInitWithDispatcher = RequestInit & { dispatcher: Dispatcher };

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function fetchValidatedHtml(
  targetUrl: string,
  signal: AbortSignal,
): Promise<{
  response: Response;
  finalUrl: string;
  dispatcher: Agent;
}> {
  let currentUrl = new URL(targetUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    signal.throwIfAborted();

    if (!validateFetchUrl(currentUrl.toString())) {
      throw new Error('Invalid fetch URL');
    }

    const addresses = await resolvePublicAddresses(currentUrl, signal);
    const dispatcher = createPinnedDispatcher(addresses);
    let response: Response;

    try {
      // The custom lookup prevents a second DNS answer from changing the connected address.
      response = await fetch(currentUrl, {
        headers: {
          'User-Agent': 'bkmk/1.0 (+https://github.com/hirokisakabe/bkmk)',
          Accept: 'text/html',
        },
        redirect: 'manual',
        signal,
        dispatcher,
      } as FetchInitWithDispatcher);
    } catch (error) {
      await dispatcher.close();
      throw error;
    }

    if (!isRedirectStatus(response.status)) {
      return { response, finalUrl: currentUrl.toString(), dispatcher };
    }

    try {
      await response.body?.cancel();
    } finally {
      await dispatcher.close();
    }
    const location = response.headers.get('location');
    if (!location || redirectCount === MAX_REDIRECTS) {
      throw new Error('Invalid or excessive redirect');
    }

    currentUrl = new URL(location, currentUrl);
  }

  throw new Error('Too many redirects');
}

async function readLimitedBody(response: Response, signal: AbortSignal): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES) {
    await reader.cancel();
    throw new Error('HTML response exceeds size limit');
  }

  const decoder = new TextDecoder();
  let result = '';
  let totalBytes = 0;

  while (true) {
    signal.throwIfAborted();
    const { done, value } = await waitWithSignal(reader.read(), signal);
    if (done) break;

    if (totalBytes + value.byteLength > MAX_HTML_BYTES) {
      await reader.cancel();
      throw new Error('HTML response exceeds size limit');
    }

    totalBytes += value.byteLength;
    result += decoder.decode(value, { stream: true });
  }

  return result + decoder.decode();
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
    const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    const { response, finalUrl, dispatcher } = await fetchValidatedHtml(targetUrl, signal);

    try {
      if (!response.ok) {
        await response.body?.cancel();
        return empty;
      }

      const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        await response.body?.cancel();
        return empty;
      }

      const html = await readLimitedBody(response, signal);
      const documentBase = await scrapeDocumentBase({ html, url: finalUrl });
      const pageUrl = documentBase.documentBaseUrl ?? finalUrl;
      const metadata = await scrapeMetadata({ html, url: pageUrl });

      return {
        title: metadata.title ?? null,
        description: metadata.description ?? null,
        imageUrl: metadata.image ? resolveHttpUrl(metadata.image, pageUrl) : null,
        faviconUrl: metadata.favicon ?? resolveHttpUrl('/favicon.ico', new URL(pageUrl).origin),
      };
    } finally {
      await dispatcher.close();
    }
  } catch {
    return empty;
  }
}
