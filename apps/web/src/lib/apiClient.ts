/**
 * The only place that calls fetch. Everything else - domain hooks,
 * components - goes through this. Requests hit the Next BFF proxy
 * (/api/*), never the Express server directly, so session handling can
 * change in one place later.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    throw new ApiError(body?.error?.message ?? res.statusText, res.status, body?.error?.details);
  }

  return res.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, body === undefined ? { method: 'POST' } : { method: 'POST', body: JSON.stringify(body) }),
};
