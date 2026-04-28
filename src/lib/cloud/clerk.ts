import { browser } from '$app/environment';
import { writable } from 'svelte/store';
// Type-only import — the runtime instance is loaded from Clerk's CDN below.
// This avoids Vite's chunk-splitting of clerk-js@6, which silently drops the
// side-effect that registers `componentControls` onto the Clerk instance
// when UI components load as separate chunks. With the CDN approach, a
// single self-contained bundle (including UI) is served from the Frontend
// API host, so `mountSignIn/mountSignUp/mountPricingTable` always work.
import type { Clerk as ClerkClass } from '@clerk/clerk-js';
import { configureConvexAuth } from './convex';

type ClerkInstance = ClerkClass;

declare global {
  interface Window {
    Clerk?: ClerkInstance;
  }
}

export interface ClerkAuthState {
  configured: boolean;
  loading: boolean;
  signedIn: boolean;
  convexAuthenticated: boolean;
  userId: string;
  userLabel: string;
  error: string;
  isPro: boolean;
}

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
const frontendApiUrl = import.meta.env.VITE_CLERK_FRONTEND_API_URL as string | undefined;
const redirectUrl = typeof window !== 'undefined' ? window.location.href : '/settings';

const initialState: ClerkAuthState = {
  configured: Boolean(publishableKey),
  loading: Boolean(publishableKey),
  signedIn: false,
  convexAuthenticated: false,
  userId: '',
  userLabel: '',
  error: '',
  isPro: false
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

// Load Clerk from the Frontend API CDN as a single self-contained script.
// Clerk's CDN-hosted bundle ships UI components and core in one file, so
// `mountSignIn` / `mountSignUp` / `mountPricingTable` work without the
// chunk-splitting issues that affect npm-bundled clerk-js@6 under Vite.
// The script auto-instantiates `window.Clerk` using the publishable key
// passed via `data-clerk-publishable-key`.
async function loadClerkFromCDN(
  pk: string,
  fapi: string | undefined
): Promise<ClerkInstance> {
  if (window.Clerk) return window.Clerk;

  // Derive Frontend API host from the publishable key when env var isn't set.
  // Clerk publishable keys encode the host as a base64-decoded payload after
  // the `pk_test_` / `pk_live_` prefix, e.g.
  // `pk_test_bm90YWJsZS10b3VjYW4tNTEuY2xlcmsuYWNjb3VudHMuZGV2JA` decodes to
  // `notable-toucan-51.clerk.accounts.dev$`.
  let host = fapi?.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!host) {
    try {
      const payload = pk.split('_').pop() ?? '';
      host = atob(payload).replace(/\$$/, '');
    } catch {
      throw new Error(
        'Could not determine Clerk Frontend API host. Set VITE_CLERK_FRONTEND_API_URL.'
      );
    }
  }
  if (!host) {
    throw new Error(
      'VITE_CLERK_FRONTEND_API_URL is required to load Clerk from the CDN.'
    );
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-clerk-script="huntflow"]'
    );
    const script = existing ?? document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://${host}/npm/@clerk/clerk-js@latest/dist/clerk.browser.js`;
    script.setAttribute('data-clerk-publishable-key', pk);
    script.setAttribute('data-clerk-script', 'huntflow');
    script.addEventListener(
      'load',
      () => {
        if (window.Clerk) {
          resolve(window.Clerk);
        } else {
          reject(
            new Error(
              'Clerk CDN script loaded but window.Clerk is undefined. ' +
                'Check that the publishable key matches the Frontend API host.'
            )
          );
        }
      },
      { once: true }
    );
    script.addEventListener(
      'error',
      () => {
        reject(
          new Error(
            `Failed to load Clerk from https://${host}/npm/@clerk/clerk-js@latest/dist/clerk.browser.js. ` +
              'Check that VITE_CLERK_FRONTEND_API_URL is correct and reachable.'
          )
        );
      },
      { once: true }
    );
    if (!existing) document.head.appendChild(script);
  });
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
      const clerk = await loadClerkFromCDN(publishableKey, frontendApiUrl);

      // clerk.load() can hang silently when the publishable key is invalid,
      // the instance is paused, or the origin isn't allowlisted on a Clerk
      // production instance. Race it against a 12s timeout so the auth pages
      // can surface a real error instead of an indefinite "Loading..." state.
      const LOAD_TIMEOUT_MS = 12_000;
      await Promise.race([
        clerk.load(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `Clerk did not finish loading within ${LOAD_TIMEOUT_MS / 1000}s. ` +
                    'Check that VITE_CLERK_PUBLISHABLE_KEY matches your active instance and that ' +
                    `${typeof window !== 'undefined' ? window.location.origin : 'this origin'} is allowed in Clerk → Domains.`
                )
              ),
            LOAD_TIMEOUT_MS
          )
        )
      ]);

      if (!listenerAttached) {
        clerk.addListener(() => {
          updateState(clerk);
          configureConvexAuth(clerk, (convexAuthenticated) => {
            clerkAuthStore.update((state) => ({ ...state, convexAuthenticated }));
          });
          // Re-check Pro plan whenever the Clerk session/user changes
          // (sign-in, sign-out, plan upgrade via PricingTable, etc.)
          void refreshProEntitlement();
        });
        listenerAttached = true;
      }

      configureConvexAuth(clerk, (convexAuthenticated) => {
        clerkAuthStore.update((state) => ({ ...state, convexAuthenticated }));
      });
      updateState(clerk, { configured: true, loading: false, error: '' });
      void refreshProEntitlement();
      return clerk;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Clerk failed to initialize.';
      console.error('[v0] Clerk init failed:', message);
      clerkAuthStore.update((state) => ({
        ...state,
        loading: false,
        error: message
      }));
      // Reset cached promise so a future call (e.g. user retry) can try again
      // from scratch instead of replaying the same rejection forever.
      clerkPromise = null;
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

// Shared dark theme so every embedded Clerk component (sign-in, sign-up,
// pricing table, user button) blends into HuntFlow's slate-950 chrome
// without restyling each call site.
export const huntflowClerkAppearance = {
  variables: {
    colorPrimary: '#14b8a6',
    colorBackground: '#0f172a',
    colorText: '#f1f5f9',
    colorTextSecondary: '#94a3b8',
    colorInputBackground: '#0f172a',
    colorInputText: '#f1f5f9',
    colorNeutral: '#94a3b8',
    borderRadius: '0.5rem',
    fontFamily: 'inherit'
  },
  elements: {
    rootBox: { width: '100%' },
    card: {
      background: 'transparent',
      boxShadow: 'none',
      border: 'none',
      width: '100%'
    },
    headerTitle: { color: '#f1f5f9' },
    headerSubtitle: { color: '#94a3b8' },
    socialButtonsBlockButton: {
      background: '#1e293b',
      border: '1px solid #334155',
      color: '#f1f5f9'
    },
    formFieldLabel: { color: '#cbd5e1' },
    formFieldInput: {
      background: '#0f172a',
      border: '1px solid #334155',
      color: '#f1f5f9'
    },
    formButtonPrimary: {
      background: '#14b8a6',
      color: '#020617',
      fontWeight: 600,
      '&:hover': { background: '#2dd4bf' }
    },
    footer: { background: 'transparent' },
    footerActionText: { color: '#94a3b8' },
    footerActionLink: { color: '#5eead4' },
    dividerLine: { background: '#1e293b' },
    dividerText: { color: '#64748b' }
  }
};

type MountSignInOptions = Parameters<ClerkInstance['mountSignIn']>[1];
type MountSignUpOptions = Parameters<ClerkInstance['mountSignUp']>[1];
type MountPricingTableOptions = Parameters<ClerkInstance['mountPricingTable']>[1];
type MountUserButtonOptions = Parameters<ClerkInstance['mountUserButton']>[1];

// Wrap every `clerk.mount*` call so mount-time exceptions (e.g. UI components
// chunk failed to load, instance paused, plan misconfigured) surface as a
// readable error in `clerkAuthStore.error` and the auth pages flip from the
// "Loading..." spinner to the actionable red error card with a Retry button.
// Without this guard, a synchronous throw inside mountSignUp leaves an
// unhandled promise rejection in the console and an indefinite spinner on screen.
function reportMountError(scope: string, error: unknown): void {
  const message = error instanceof Error ? error.message : `${scope} failed to mount.`;
  console.error(`[v0] Clerk ${scope} mount failed:`, message);
  clerkAuthStore.update((state) => ({ ...state, loading: false, error: message }));
}

export async function mountClerkSignIn(
  node: HTMLElement,
  options: MountSignInOptions = {}
): Promise<() => void> {
  const clerk = await initClerk();
  if (!clerk) return () => {};
  try {
    clerk.mountSignIn(node, { appearance: huntflowClerkAppearance, ...options });
    return () => clerk.unmountSignIn(node);
  } catch (error) {
    reportMountError('sign-in', error);
    return () => {};
  }
}

export async function mountClerkSignUp(
  node: HTMLElement,
  options: MountSignUpOptions = {}
): Promise<() => void> {
  const clerk = await initClerk();
  if (!clerk) return () => {};
  try {
    clerk.mountSignUp(node, { appearance: huntflowClerkAppearance, ...options });
    return () => clerk.unmountSignUp(node);
  } catch (error) {
    reportMountError('sign-up', error);
    return () => {};
  }
}

export async function mountClerkUserButton(
  node: HTMLElement,
  options: MountUserButtonOptions = {}
): Promise<() => void> {
  const clerk = await initClerk();
  if (!clerk) return () => {};
  try {
    clerk.mountUserButton(node, {
      appearance: huntflowClerkAppearance,
      // After signing out from the user button on a chromeless landing,
      // bounce back to the public landing page instead of leaving the
      // visitor on a now-ambiguous "you used to be signed in" view.
      afterSignOutUrl: '/',
      ...options
    });
    return () => clerk.unmountUserButton(node);
  } catch (error) {
    reportMountError('user button', error);
    return () => {};
  }
}

export async function mountClerkPricingTable(
  node: HTMLElement,
  options: MountPricingTableOptions = {}
): Promise<() => void> {
  const clerk = await initClerk();
  if (!clerk) return () => {};
  // mountPricingTable is part of Clerk Billing — only available when the
  // dashboard has the billing addon enabled. Fall back gracefully if not.
  if (typeof clerk.mountPricingTable !== 'function') return () => {};
  try {
    clerk.mountPricingTable(node, { appearance: huntflowClerkAppearance, ...options });
    return () => clerk.unmountPricingTable?.(node);
  } catch (error) {
    reportMountError('pricing table', error);
    return () => {};
  }
}

// Pro entitlement helpers. Clerk Billing exposes `user.has({ plan })` to check
// whether the active user is on a paid plan. We expose a derived boolean on
// the auth store so any component can react to plan changes without re-querying.
export async function refreshProEntitlement(): Promise<void> {
  const clerk = await initClerk();
  if (!clerk) return;
  const user = clerk.user;
  let isPro = false;
  if (user && typeof (user as unknown as { has?: (q: unknown) => boolean }).has === 'function') {
    try {
      isPro = Boolean(
        (user as unknown as { has: (q: { plan: string }) => boolean }).has({ plan: 'huntflow_pro' })
      );
    } catch {
      isPro = false;
    }
  }
  clerkAuthStore.update((state) => ({ ...state, isPro }));
}
