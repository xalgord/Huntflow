import { browser } from '$app/environment';
import { ConvexClient } from 'convex/browser';
import { anyApi } from 'convex/server';

type ClerkInstance = import('@clerk/clerk-js').Clerk;

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

let client: ConvexClient | null = null;
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
