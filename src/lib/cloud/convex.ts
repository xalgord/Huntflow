import { browser } from '$app/environment';
import { ConvexClient } from 'convex/browser';
import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';

function cleanEnvValue(value: string | undefined): string | undefined {
  const cleaned = value?.replace(/\\n/g, '').trim();
  return cleaned || undefined;
}

const convexUrl = cleanEnvValue(import.meta.env.VITE_CONVEX_URL as string | undefined);

let client: ConvexClient | null = null;
let httpClient: ConvexHttpClient | null = null;
let authConfigured = false;

export const cloudConfigured = Boolean(convexUrl);

export const cloudApi = {
  getSnapshot: anyApi.sync.getSnapshot,
  upsertSnapshot: anyApi.sync.upsertSnapshot,
  generateAssetUploadUrl: anyApi.sync.generateAssetUploadUrl,
  registerAssetFile: anyApi.sync.registerAssetFile,
  cleanupExpiredUploadTickets: anyApi.sync.cleanupExpiredUploadTickets,
  getAssetFileUrl: anyApi.sync.getAssetFileUrl,
  deleteAssetFile: anyApi.sync.deleteAssetFile,
  clearCloud: anyApi.sync.clearCloud
};

export function getConvexClient(): ConvexClient | null {
  if (!browser || !convexUrl) return null;
  client ??= new ConvexClient(convexUrl);
  return client;
}

/**
 * Wire the ConvexClient's auth callback to a provider-agnostic token
 * getter. The shape of `getToken` matches Convex's own `setAuth`
 * contract exactly, so the getter is forwarded as-is.
 *
 * `firebase.ts` is the canonical token source; it passes
 * `getFirebaseIdToken` here. Tests can pass any function with the
 * same signature without depending on a concrete auth provider.
 */
export function configureConvexAuth(
  getToken: (opts: { forceRefreshToken: boolean }) => Promise<string | null>,
  onChange: (isAuthenticated: boolean) => void
): void {
  const convex = getConvexClient();
  if (!convex || authConfigured) return;

  convex.setAuth(getToken, onChange);
  authConfigured = true;
}

/**
 * Reset the auth flag so that the next `configureConvexAuth` call
 * will re-bind the Convex client to a new session.
 * Must be called on sign-out.
 */
export function resetConvexAuth(): void {
  authConfigured = false;
}

/**
 * Returns a ConvexHttpClient that makes direct HTTP requests, bypassing the
 * WebSocket client's cache. Used for polling to guarantee fresh data.
 */
export function getConvexHttpClient(): ConvexHttpClient | null {
  if (!browser || !convexUrl) return null;
  httpClient ??= new ConvexHttpClient(convexUrl);
  return httpClient;
}
