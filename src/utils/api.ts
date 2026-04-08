import { API_BASE_URL } from '../constants';

export interface SyncPayload {
  transactions: any[];
  settings: any;
}

export interface SyncResponse {
  payload: SyncPayload | null;
  version: number;
  updatedAt: number;
}

async function request<T>(path: string, opts: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...opts, headers });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }

  if (!res.ok) {
    const err: any = new Error(body?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body as T;
}

export const api = {
  register(username: string, pin: string) {
    return request<{ token: string; username: string }>('/register', {
      method: 'POST',
      body: JSON.stringify({ username, pin }),
    });
  },
  login(username: string, pin: string) {
    return request<{ token: string; username: string }>('/login', {
      method: 'POST',
      body: JSON.stringify({ username, pin }),
    });
  },
  me(token: string) {
    return request<{ username: string }>('/me', { method: 'GET' }, token);
  },
  pull(token: string) {
    return request<SyncResponse>('/sync', { method: 'GET' }, token);
  },
  push(token: string, payload: SyncPayload, version: number, force = false) {
    return request<{ version: number; updatedAt: number }>(
      '/sync',
      { method: 'POST', body: JSON.stringify({ payload, version, force }) },
      token,
    );
  },
};
