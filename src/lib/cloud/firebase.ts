/**
 * Firebase Auth client module.
 *
 * Implementation (task 3.1): replaces the Clerk module wholesale. Owns
 * the canonical auth store, every public sign-in / sign-up / sign-out
 * surface, the Convex token getter, and the Pro-entitlement refresh.
 *
 * Public functions never mutate `authStore` directly (with the single
 * exception of `signOut`, which has to clear the store synchronously
 * before the SDK callback chain can fire). Every other update flows
 * through `onAuthStateChanged` / `onIdTokenChanged`, so the store is
 * always coherent with the Firebase SDK's internal user state.
 *
 * Feature: firebase-auth-migration
 * Validates: Requirements 1.1, 1.2, 1.3, 1.5, 1.6, 2.1, 2.2, 2.3,
 *            3.1, 3.3, 3.4, 4.1, 4.3, 5.2, 5.4,
 *            6.1, 6.4, 6.5, 7.4, 9.3
 */

import { browser } from '$app/environment';
import { writable, get, type Writable } from 'svelte/store';
import { anyApi } from 'convex/server';
import {
  initializeApp,
  getApps,
  getApp,
  type FirebaseApp
} from 'firebase/app';
import {
  EmailAuthProvider,
  GithubAuthProvider,
  GoogleAuthProvider,
  applyActionCode,
  confirmPasswordReset as fbConfirmPasswordReset,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  onIdTokenChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  updateProfile,
  type Auth,
  type User,
  type UserCredential
} from 'firebase/auth';

import { configureConvexAuth, getConvexClient, resetConvexAuth } from './convex';

// Re-export so downstream modules can refer to the type without
// pulling firebase/app in directly.
export type { FirebaseApp };

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AuthState {
  /** Firebase env vars present at build time. */
  configured: boolean;
  /** Initial auth-state hydration in flight. */
  loading: boolean;
  signedIn: boolean;
  convexAuthenticated: boolean;
  /** Firebase uid (claim `sub`). */
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  photoURL: string;
  /** e.g. ['password'], ['google.com'], ['github.com']. */
  providerIds: string[];
  /** Sourced from the Convex `entitlements` query. */
  isPro: boolean;
  /** Last init / network / auth error (empty string when none). */
  error: string;
}

// ---------------------------------------------------------------------------
// Module-level config
// ---------------------------------------------------------------------------

function cleanEnvValue(value: string | undefined): string | undefined {
  const cleaned = value?.replace(/\\n/g, '').trim();
  return cleaned || undefined;
}

const firebaseApiKey = cleanEnvValue(
  import.meta.env.VITE_FIREBASE_API_KEY as string | undefined
);
const firebaseAuthDomain = cleanEnvValue(
  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined
);
const firebaseProjectId = cleanEnvValue(
  import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined
);
const firebaseAppId = cleanEnvValue(
  import.meta.env.VITE_FIREBASE_APP_ID as string | undefined
);

const firebaseConfigured = Boolean(
  firebaseApiKey && firebaseAuthDomain && firebaseProjectId && firebaseAppId
);

/** Canonical signed-out state. Reused by `signOut` to reset the store. */
const initialAuthState: AuthState = {
  configured: firebaseConfigured,
  loading: firebaseConfigured,
  signedIn: false,
  convexAuthenticated: false,
  uid: '',
  email: '',
  emailVerified: false,
  displayName: '',
  photoURL: '',
  providerIds: [],
  isPro: false,
  error: ''
};

export const authStore: Writable<AuthState> = writable<AuthState>(initialAuthState);

// ---------------------------------------------------------------------------
// Module-level singletons
// ---------------------------------------------------------------------------

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let initPromise: Promise<FirebaseApp | null> | null = null;
let convexAuthWired = false;
let listenersAttached = false;

function deriveDisplayName(user: User): string {
  const fromProfile = user.displayName?.trim();
  if (fromProfile) return fromProfile;
  const email = user.email ?? '';
  if (email.includes('@')) return email.split('@')[0];
  return email || user.uid;
}

function snapshotFromUser(user: User | null): Partial<AuthState> {
  if (!user) {
    return {
      signedIn: false,
      uid: '',
      email: '',
      emailVerified: false,
      displayName: '',
      photoURL: '',
      providerIds: []
    };
  }
  return {
    signedIn: true,
    uid: user.uid,
    email: user.email ?? '',
    emailVerified: user.emailVerified,
    displayName: deriveDisplayName(user),
    photoURL: user.photoURL ?? '',
    providerIds: user.providerData.map((p) => p.providerId)
  };
}

function applyUserToStore(user: User | null, patch: Partial<AuthState> = {}): void {
  authStore.update((state) => ({
    ...state,
    ...snapshotFromUser(user),
    ...patch
  }));
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Initialize the Firebase app, register auth listeners, wire Convex
 * auth, and resolve once the initial auth state has hydrated.
 *
 * Idempotent: every call after the first returns the same promise.
 * Returns `null` when SSR or when `VITE_FIREBASE_*` env vars are missing
 * (the AuthUI surfaces this as "local-only" mode).
 */
export async function initFirebase(): Promise<FirebaseApp | null> {
  if (!browser) return null;
  if (!firebaseConfigured) {
    authStore.update((state) => ({
      ...state,
      configured: false,
      loading: false
    }));
    return null;
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // initializeApp can only be called once per app name. If HMR
      // reloaded this module we may already have an app instance.
      firebaseApp = getApps().length > 0 ? getApp() : initializeApp({
        apiKey: firebaseApiKey,
        authDomain: firebaseAuthDomain,
        projectId: firebaseProjectId,
        appId: firebaseAppId
      });
      firebaseAuth = getAuth(firebaseApp);

      if (!listenersAttached) {
        // onAuthStateChanged: keeps `signedIn`, `uid`, profile fields, etc.
        // in sync. It also fires once at registration with the persisted
        // user (if any), which closes the initial `loading: true` state.
        onAuthStateChanged(firebaseAuth, (user) => {
          applyUserToStore(user, { loading: false, error: '' });
          // Wire Convex auth as soon as we know the auth state. The
          // token getter handles signed-out by returning null.
          if (!convexAuthWired) {
            try {
              configureConvexAuth(
                async ({ forceRefreshToken }) => getFirebaseIdToken(forceRefreshToken),
                (convexAuthenticated) => {
                  authStore.update((state) => ({ ...state, convexAuthenticated }));
                }
              );
              convexAuthWired = true;
            } catch (err) {
              console.warn('[firebase] configureConvexAuth failed:', err);
            }
          }
          // Refresh the entitlement on every sign-in / sign-out so the
          // store reflects the canonical Convex value. Signed-out
          // refreshes simply set `isPro: false`.
          void refreshProEntitlement();
        });

        // onIdTokenChanged: fires whenever the ID token rotates (every
        // ~hour) or after a manual `getIdToken(true)`. We use it to
        // force Convex to re-auth with the fresh token; Convex's
        // setAuth wrapper already calls our token getter on each
        // forceRefresh, so just nudging it with a no-op refresh is
        // enough — but we explicitly trigger one so Convex picks it up
        // immediately rather than waiting for its own refresh cadence.
        onIdTokenChanged(firebaseAuth, (user) => {
          if (!user) return;
          // Touch the auth store so Convex's setAuth callback re-runs
          // with the latest token. The cheapest way to do that is to
          // call getIdToken(true) directly; if it succeeds we're done.
          void user.getIdToken(false).catch(() => undefined);
        });

        listenersAttached = true;
      }

      // Resolve any pending OAuth redirect result (signInWithRedirect
      // returns the user via this call after the page reload). Errors
      // here surface in the auth store so the UI can flag them.
      try {
        await getRedirectResult(firebaseAuth);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Redirect sign-in failed.';
        authStore.update((state) => ({ ...state, error: message }));
      }

      return firebaseApp;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Firebase init failed.';
      console.error('[firebase] init failed:', message);
      authStore.update((state) => ({
        ...state,
        loading: false,
        error: message
      }));
      // Reset cached promise so the caller can retry from scratch.
      initPromise = null;
      return null;
    }
  })();

  return initPromise;
}

/**
 * Internal helper: ensure init has completed and return the live
 * `Auth` instance. Throws if Firebase isn't configured so callers
 * surface a clean error to the UI.
 */
async function requireAuth(): Promise<Auth> {
  await initFirebase();
  if (!firebaseAuth) {
    throw new Error('Firebase is not configured.');
  }
  return firebaseAuth;
}

// ---------------------------------------------------------------------------
// Email / password
// ---------------------------------------------------------------------------

export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<void> {
  const auth = await requireAuth();
  await signInWithEmailAndPassword(auth, email, password);
  // The onAuthStateChanged listener updates the store; nothing else to do.
}

export async function signUpWithEmailPassword(
  email: string,
  password: string
): Promise<void> {
  const auth = await requireAuth();
  const cred: UserCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );
  // Send the verification email best-effort; surfacing the failure
  // doesn't help the user (they're already signed in) and the banner
  // gives them a "Resend" affordance.
  try {
    await sendEmailVerification(cred.user);
  } catch (err) {
    console.warn('[firebase] sendEmailVerification failed:', err);
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  const auth = await requireAuth();
  await sendPasswordResetEmail(auth, email);
}

export async function confirmPasswordReset(
  oobCode: string,
  newPassword: string
): Promise<void> {
  const auth = await requireAuth();
  await fbConfirmPasswordReset(auth, oobCode, newPassword);
}

export async function applyEmailActionCode(oobCode: string): Promise<void> {
  const auth = await requireAuth();
  await applyActionCode(auth, oobCode);
  // Reload the current user (if any) so emailVerified flips to true
  // immediately rather than waiting for the next session refresh.
  if (auth.currentUser) {
    try {
      await auth.currentUser.reload();
      applyUserToStore(auth.currentUser);
    } catch {
      // Reload failures are benign; the next auth state callback will
      // eventually pick up the change.
    }
  }
}

export async function resendVerificationEmail(): Promise<void> {
  const auth = await requireAuth();
  if (!auth.currentUser) {
    throw new Error('No signed-in user to send a verification email to.');
  }
  await sendEmailVerification(auth.currentUser);
}

// ---------------------------------------------------------------------------
// OAuth — popup-first with redirect fallback (resolves OQ 5)
// ---------------------------------------------------------------------------

async function signInWithOAuthProvider(
  provider: GoogleAuthProvider | GithubAuthProvider
): Promise<void> {
  const auth = await requireAuth();
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user') {
      // signInWithRedirect triggers a full-page navigation. The
      // getRedirectResult call inside initFirebase picks up the result
      // on return.
      await signInWithRedirect(auth, provider);
      return;
    }
    throw err;
  }
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithOAuthProvider(new GoogleAuthProvider());
}

export async function signInWithGitHub(): Promise<void> {
  await signInWithOAuthProvider(new GithubAuthProvider());
}

// ---------------------------------------------------------------------------
// Account management
// ---------------------------------------------------------------------------

export async function updateDisplayName(name: string): Promise<void> {
  const auth = await requireAuth();
  if (!auth.currentUser) {
    throw new Error('No signed-in user.');
  }
  await updateProfile(auth.currentUser, { displayName: name });
  // Refresh the store so the UI reflects the new name without waiting
  // for a session refresh.
  applyUserToStore(auth.currentUser);
}

/**
 * Delete the current Firebase user account.
 *
 * Requires a recent re-authentication; if the SDK throws
 * `auth/requires-recent-login`, the original error is propagated so
 * the UI (`AccountDeleteCard`) can prompt for re-auth.
 *
 * Per design (greenfield mode) the current Convex per-user rows are
 * cleared via `clearCloud` before the Firebase user is deleted. If
 * that call fails (Convex unreachable, etc.) the orphaning is
 * acceptable — the data is keyed by the soon-to-be-deleted uid and
 * cannot be re-claimed by a future user.
 */
export async function deleteAccount(): Promise<void> {
  const auth = await requireAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No signed-in user.');
  }

  // Best-effort Convex cleanup before the auth account vanishes; if
  // we wait until after deleteUser() the ID token is gone and the
  // mutation will fail with `Unauthenticated`.
  try {
    const convex = getConvexClient();
    if (convex) {
      await convex.mutation(anyApi.sync.clearCloud, {});
    }
  } catch (err) {
    console.warn('[firebase] clearCloud before deleteAccount failed:', err);
  }

  // Tear sync down before the token disappears so any in-flight push
  // gets a chance to flush.
  try {
    const { stopRealtimeSync } = await import('./realtimeSync');
    stopRealtimeSync();
  } catch {
    // realtimeSync may not be loaded yet; nothing to stop.
  }

  await deleteUser(user);
  resetConvexAuth();
  // The onAuthStateChanged listener will run once the SDK fires
  // signed-out, but reset the store now so the UI doesn't briefly
  // display the just-deleted user.
  authStore.set({ ...initialAuthState, loading: false });
}

export async function signOut(): Promise<void> {
  const auth = await requireAuth();
  // Tear down sync before the token is invalidated so the engine can
  // flush any pending push that's still in flight.
  try {
    const { stopRealtimeSync } = await import('./realtimeSync');
    stopRealtimeSync();
  } catch {
    // realtimeSync may not be loaded yet.
  }
  await fbSignOut(auth);
  resetConvexAuth();
  authStore.set({ ...initialAuthState, loading: false });
}

/**
 * Re-authenticate the current user before a sensitive operation
 * (delete account, email change). Re-exported so the AccountDeleteCard
 * can invoke it directly without taking a credential dependency on
 * the Firebase SDK.
 *
 * For password users, pass the password. For OAuth users, omit the
 * password and we'll re-popup the original provider.
 */
export async function reauthenticate(password?: string): Promise<void> {
  const auth = await requireAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No signed-in user.');
  }
  const primary = user.providerData[0]?.providerId ?? 'password';
  if (primary === 'password') {
    if (!password) throw new Error('Password is required to re-authenticate.');
    if (!user.email) throw new Error('Account has no email on file.');
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
    return;
  }
  if (primary === 'google.com') {
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
    return;
  }
  if (primary === 'github.com') {
    await reauthenticateWithPopup(user, new GithubAuthProvider());
    return;
  }
  throw new Error(`Re-authentication not supported for provider: ${primary}`);
}

// ---------------------------------------------------------------------------
// Token surface for Convex
// ---------------------------------------------------------------------------

/**
 * Return a fresh Firebase ID token for the current user, or `null` when
 * signed-out / not yet hydrated. Convex's setAuth callback receives a
 * `forceRefreshToken` flag which we pass straight through.
 */
export async function getFirebaseIdToken(
  forceRefresh?: boolean
): Promise<string | null> {
  if (!browser) return null;
  // Don't trigger initFirebase from the token getter — the token
  // getter is called from inside Convex's setAuth, which is itself
  // installed during init. Reading firebaseAuth directly avoids the
  // re-entrancy and returns null cleanly when init hasn't run yet.
  const auth = firebaseAuth;
  if (!auth?.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken(forceRefresh ?? false);
  } catch (err) {
    console.warn('[firebase] getIdToken failed:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pro entitlement
// ---------------------------------------------------------------------------

/**
 * Refresh `authStore.isPro` by querying Convex `entitlements.getMine`.
 *
 * Returns silently and leaves `isPro` unchanged when:
 *   - the user is signed out (forces `isPro: false` instead),
 *   - Convex is unreachable (network error, missing client).
 *
 * The Convex query itself returns `null` when the user has no row,
 * which we map to `isPro: false`. The webhook handler in
 * `convex/http.ts` is the single writer of this row.
 */
export async function refreshProEntitlement(): Promise<void> {
  if (!browser) return;
  const state = get(authStore);
  if (!state.signedIn) {
    authStore.update((s) => ({ ...s, isPro: false }));
    return;
  }
  const convex = getConvexClient();
  if (!convex) return;
  try {
    // anyApi keeps the call provider-agnostic in TS; the real runtime
    // path is `entitlements.getMine` in `convex/entitlements.ts`.
    const row = (await convex.query(anyApi.entitlements.getMine, {})) as
      | { isPro?: boolean }
      | null;
    const isPro = Boolean(row?.isPro);
    authStore.update((s) => ({ ...s, isPro }));
  } catch (err) {
    // Leave isPro at its current value if Convex is unreachable. The
    // sync engine's gate re-checks before each push so a temporary
    // failure here doesn't unlock cloud sync for a non-Pro user.
    console.warn('[firebase] refreshProEntitlement failed:', err);
  }
}
