/**
 * Client for the HuntFlow cloud API (Cloudflare Pages Functions + D1 +
 * R2, see `/server`). Every call carries the signed-in user's Firebase
 * ID token as a bearer token; nothing here holds a session cookie.
 *
 * The API is served from the same origin as the hosted app. Builds
 * that run elsewhere (the npm CLI, local dev) point at the hosted API
 * with `VITE_CLOUD_API_URL`; set it to `off` to build without cloud.
 *
 * `firebase.ts` registers the token provider at startup, which keeps
 * this module free of any Firebase import (and of an import cycle).
 */
import { browser } from '$app/environment';

function cleanEnvValue(value: string | undefined): string | undefined {
  const cleaned = value?.replace(/\\n/g, '').trim();
  return cleaned || undefined;
}

const apiSetting = cleanEnvValue(import.meta.env.VITE_CLOUD_API_URL as string | undefined);
const firebaseReady = Boolean(
  cleanEnvValue(import.meta.env.VITE_FIREBASE_API_KEY as string | undefined) &&
    cleanEnvValue(import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined)
);

/** Base URL for API calls: '' means "same origin as the app". */
export const cloudApiBase = apiSetting && apiSetting !== 'off' ? apiSetting.replace(/\/+$/, '') : '';

/** Cloud features need a Firebase project and an API to talk to. */
export const cloudConfigured = firebaseReady && apiSetting !== 'off';

export type CloudTokenProvider = (forceRefresh?: boolean) => Promise<string | null>;

let tokenProvider: CloudTokenProvider | null = null;

export function setCloudTokenProvider(provider: CloudTokenProvider | null): void {
  tokenProvider = provider;
}

export class CloudApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'CloudApiError';
    this.status = status;
    this.code = code;
  }
}

async function toError(response: Response): Promise<CloudApiError> {
  let message = `The HuntFlow cloud returned HTTP ${response.status}.`;
  let code = 'http_error';
  try {
    const body = (await response.json()) as { error?: unknown; code?: unknown };
    if (typeof body.error === 'string' && body.error) message = body.error;
    if (typeof body.code === 'string' && body.code) code = body.code;
  } catch {
    // Non-JSON error body (proxy, outage page): keep the generic message.
  }
  return new CloudApiError(response.status, code, message);
}

export interface CloudFetchOptions extends RequestInit {
  /** Send the Firebase ID token (default true). */
  auth?: boolean;
}

/**
 * Fetch `/api<path>`. Retries once with a force-refreshed token on 401
 * (covers the hourly ID-token rotation) and throws `CloudApiError` for
 * any non-2xx response.
 */
export async function cloudFetch(path: string, options: CloudFetchOptions = {}): Promise<Response> {
  if (!browser) throw new CloudApiError(0, 'unavailable', 'The HuntFlow cloud is only reachable from the browser.');
  if (!cloudConfigured) throw new CloudApiError(0, 'not_configured', 'Cloud sync is not configured for this build.');
  const { auth = true, ...init } = options;

  const attempt = async (forceRefresh: boolean): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (auth) {
      const token = tokenProvider ? await tokenProvider(forceRefresh) : null;
      if (!token) throw new CloudApiError(401, 'unauthenticated', 'Sign in to use cloud features.');
      headers.set('authorization', `Bearer ${token}`);
    }
    return fetch(`${cloudApiBase}/api${path}`, { ...init, headers, cache: 'no-store' });
  };

  let response = await attempt(false);
  if (response.status === 401 && auth) response = await attempt(true);
  if (!response.ok) throw await toError(response);
  return response;
}

export async function cloudJson<T>(path: string, options: CloudFetchOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && typeof options.body === 'string' && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const response = await cloudFetch(path, { ...options, headers });
  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Typed endpoints
// ---------------------------------------------------------------------------

export interface CloudAccount {
  uid: string;
  email: string;
  isPro: boolean;
  currentPeriodEnd: number | null;
}

export function fetchCloudAccount(): Promise<CloudAccount> {
  return cloudJson<CloudAccount>('/me');
}

/** Wire shape for a push. `payload` is pre-serialised JSON text. */
export interface PushWireItem {
  collection: string;
  localId: string;
  payload: string;
  updatedAt: number;
  deletedAt?: number;
}

export interface PushResult {
  accepted: number;
  changed: number;
  invalid: number;
  /** The user's change counter after this push. */
  seq: number;
  /** The counter just before this push. */
  prevSeq: number;
}

export function pushSyncItems(items: PushWireItem[]): Promise<PushResult> {
  return cloudJson<PushResult>('/sync/push', { method: 'POST', body: JSON.stringify({ items }) });
}

export interface ChangesPage {
  items: unknown[];
  cursor: string;
  hasMore: boolean;
  head: number;
  reset: boolean;
}

export function fetchSyncChanges(cursor: string | null): Promise<ChangesPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return cloudJson<ChangesPage>(`/sync/changes${query}`);
}

export function clearCloudCopy(): Promise<{ deleted: number; skippedFiles: number }> {
  return cloudJson('/sync/clear', { method: 'POST' });
}

export function createCheckoutSession(returnUrl: string, cancelUrl: string): Promise<{ checkoutUrl: string }> {
  return cloudJson('/billing/checkout', { method: 'POST', body: JSON.stringify({ returnUrl, cancelUrl }) });
}

export function createCustomerPortalSession(): Promise<{ url: string }> {
  return cloudJson('/billing/portal', { method: 'POST' });
}
