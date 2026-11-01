import type { ApiErrorBody, AuthResponse, CursorMeta, PageMeta } from '@recruitflow/shared';
import { useAuth } from '@/stores/auth';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
    public requestId?: string,
  ) {
    super(message);
  }

  /** Field errors from a VALIDATION_ERROR response, keyed by field path. */
  get fieldErrors(): Record<string, string[]> {
    const d = this.details as { fieldErrors?: Record<string, string[]> } | undefined;
    return d?.fieldErrors ?? {};
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

type Query = Record<string, string | number | boolean | null | undefined | string[]>;

interface RequestOptions {
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  /** Skip the automatic refresh-and-retry on 401 (used by the auth endpoints themselves). */
  noRefresh?: boolean;
}

export interface Envelope<T> {
  data: T;
  meta?: PageMeta | CursorMeta;
}

const BASE = '/api';

function buildUrl(path: string, query?: Query) {
  const url = new URL(BASE + path, window.location.origin);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  return url.pathname + url.search;
}

let refreshing: Promise<boolean> | null = null;

/** Single-flight refresh so a burst of 401s triggers exactly one rotation. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!res.ok) return false;
      const json = (await res.json()) as { data: AuthResponse };
      useAuth.getState().setSession(json.data.accessToken, json.data.user);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

async function request<T>(method: string, path: string, opts: RequestOptions = {}, retried = false): Promise<Envelope<T>> {
  const token = useAuth.getState().accessToken;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      headers,
      credentials: 'include',
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', "Can't reach RecruitFlow. Check your connection and try again.");
  }

  if (res.status === 401 && !opts.noRefresh && !retried && token) {
    const body = (await res.clone().json().catch(() => null)) as ApiErrorBody | null;
    const code = body?.error.code;
    if (code === 'TOKEN_EXPIRED' || code === 'INVALID_TOKEN') {
      if (await refreshSession()) return request<T>(method, path, opts, true);
      useAuth.getState().clear({ expired: true });
    } else if (code === 'MEMBERSHIP_REVOKED' || code === 'SESSION_REVOKED') {
      useAuth.getState().clear({ expired: true });
    }
  }

  if (res.status === 204) return { data: undefined as T };
  const json = (await res.json().catch(() => null)) as ({ success: true } & Envelope<T>) | ApiErrorBody | null;
  if (!res.ok || !json || json.success === false) {
    const e = (json as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, e?.code ?? 'UNKNOWN', e?.message ?? `Request failed (${res.status})`, e?.details, e?.requestId);
  }
  return { data: json.data, meta: json.meta };
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>('GET', path, { query, signal }).then((r) => r.data),
  getEnvelope: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>('GET', path, { query, signal }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'body'>) => request<T>('POST', path, { ...opts, body: body ?? {} }).then((r) => r.data),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body: body ?? {} }).then((r) => r.data),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body: body ?? {} }).then((r) => r.data),
  delete: <T>(path: string) => request<T>('DELETE', path).then((r) => r.data),
};

export const errorMessage = (e: unknown, fallback = 'Something went wrong') =>
  isApiError(e) ? e.message : e instanceof Error ? e.message : fallback;
