export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers: HeadersInit = { ...init?.headers };

  if (init?.body && !(init.body instanceof FormData)) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });
  return response;
}
