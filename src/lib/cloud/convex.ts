import { browser } from '$app/environment';
import { ConvexClient } from 'convex/browser';
import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';

type ClerkInstance = import('@clerk/clerk-js').Clerk;

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

let client: ConvexClient | null = null;
let httpClient: ConvexHttpClient | null = null;
let authConfigured = false;

export const cloudConfigured = Boolean(convexUrl);

export const cloudApi = {
  getSnapshot: anyApi.sync.getSnapshot,
  upsertSnapshot: anyApi.sync.upsertSnapshot,
  generateAssetUploadUrl: anyApi.sync.generateAssetUploadUrl,
  registerAssetFile: anyApi.sync.registerAssetFile,
  getAssetFileUrl: anyApi.sync.getAssetFileUrl,
  deleteAssetFile: anyApi.sync.deleteAssetFile,
  clearCloud: anyApi.sync.clearCloud
};

export function getConvexClient(): ConvexClient | null {
  if (!browser || !convexUrl) return null;
  client ??= new ConvexClient(convexUrl);
  return client;
}

export function configureConvexAuth(
  clerk: ClerkInstance,
  onChange: (isAuthenticated: boolean) => void
): void {
  const convex = getConvexClient();
  if (!convex || authConfigured) return;

  convex.setAuth(
    async ({ forceRefreshToken }) =>
      clerk.session?.getToken({
        template: 'convex',
        skipCache: forceRefreshToken
      }) ?? null,
    onChange
  );
  authConfigured = true;
}

/**
 * Reset the auth flag so that the next `configureConvexAuth` call
 * will re-bind the Convex client to the new Clerk session.
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

/**
 * Retrieve a fresh Clerk JWT for authenticating the ConvexHttpClient.
 * Returns null if the session isn't available.
 */
export async function getClerkToken(): Promise<string | null> {
  const clerk = window.Clerk;
  if (!clerk?.session) return null;
  try {
    return await clerk.session.getToken({ template: 'convex', skipCache: true }) ?? null;
  } catch (err) {
    console.warn('[convex] Failed to get Clerk token for HTTP client:', err);
    return null;
  }
}
