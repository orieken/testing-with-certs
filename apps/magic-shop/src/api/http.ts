import { getAccessToken } from '../auth/session';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export async function apiJson<T>(path: string, options: {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  idempotencyKey?: string;
} = {}): Promise<T> {
  if (!path.startsWith('/api/')) throw new Error('Public API path required');
  const token = await getAccessToken();
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
    signal: AbortSignal.timeout(10_000),
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(options.idempotencyKey ? { 'idempotency-key': options.idempotencyKey } : {})
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
  });
  if (!response.ok) throw new ApiError(response.status, `Service unavailable (${response.status})`);
  if (response.status === 204) return undefined as T;
  const size = Number(response.headers.get('content-length'));
  if (Number.isFinite(size) && size > 1_048_576) throw new Error('Response too large');
  const raw = await response.text();
  if (raw.length > 1_048_576) throw new Error('Response too large');
  return JSON.parse(raw) as T;
}

export function query(path: string, fields: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) if (value !== undefined && value !== '') params.set(key, String(value));
  return `${path}?${params}`;
}
