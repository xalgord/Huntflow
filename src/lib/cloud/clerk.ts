import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { configureConvexAuth } from './convex';

type ClerkInstance = import('@clerk/clerk-js').Clerk;

export interface ClerkAuthState {
  configured: boolean;
  loading: boolean;
  signedIn: boolean;
  convexAuthenticated: boolean;
  userId: string;
  userLabel: string;
  error: string;
}

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
const redirectUrl = typeof window !== 'undefined' ? window.location.href : '/settings';

const initialState: ClerkAuthState = {
  configured: Boolean(publishableKey),
  loading: Boolean(publishableKey),
  signedIn: false,
  convexAuthenticated: false,
  userId: '',
  userLabel: '',
  error: ''
};

export const clerkAuthStore = writable<ClerkAuthState>(initialState);

let clerkPromise: Promise<ClerkInstance | null> | null = null;
let listenerAttached = false;

function labelFor(clerk: ClerkInstance): string {
  return (
    clerk.user?.primaryEmailAddress?.emailAddress ??
    clerk.user?.fullName ??
    clerk.user?.username ??
    clerk.user?.id ??
    ''
  );
}

function updateState(clerk: ClerkInstance | null, patch: Partial<ClerkAuthState> = {}): void {
  clerkAuthStore.update((state) => ({
    ...state,
    signedIn: Boolean(clerk?.isSignedIn),
    userId: clerk?.user?.id ?? '',
    userLabel: clerk ? labelFor(clerk) : '',
    ...patch
  }));
}

export async function initClerk(): Promise<ClerkInstance | null> {
  if (!browser || !publishableKey) {
    clerkAuthStore.update((state) => ({
      ...state,
      configured: Boolean(publishableKey),
      loading: false
    }));
    return null;
  }

  if (clerkPromise) return clerkPromise;

  clerkPromise = (async () => {
    try {
      const { Clerk } = await import('@clerk/clerk-js');
      const clerk = new Clerk(publishableKey);
      await clerk.load();

      if (!listenerAttached) {
        clerk.addListener(() => {
          updateState(clerk);
          configureConvexAuth(clerk, (convexAuthenticated) => {
            clerkAuthStore.update((state) => ({ ...state, convexAuthenticated }));
          });
        });
        listenerAttached = true;
      }

      configureConvexAuth(clerk, (convexAuthenticated) => {
        clerkAuthStore.update((state) => ({ ...state, convexAuthenticated }));
      });
      updateState(clerk, { configured: true, loading: false, error: '' });
      return clerk;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Clerk failed to initialize.';
      clerkAuthStore.update((state) => ({
        ...state,
        loading: false,
        error: message
      }));
      return null;
    }
  })();

  return clerkPromise;
}

export async function signInWithClerk(): Promise<void> {
  const clerk = await initClerk();
  if (!clerk) return;
  await clerk.redirectToSignIn({ redirectUrl, signUpFallbackRedirectUrl: redirectUrl });
}

export async function signUpWithClerk(): Promise<void> {
  const clerk = await initClerk();
  if (!clerk) return;
  await clerk.redirectToSignUp({ redirectUrl, signInFallbackRedirectUrl: redirectUrl });
}

export async function signOutFromClerk(): Promise<void> {
  const clerk = await initClerk();
  if (!clerk) return;
  await clerk.signOut({ redirectUrl });
  updateState(clerk, { convexAuthenticated: false });
}
