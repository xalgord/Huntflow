/**
 * Property 6 — Sign-out is idempotent.
 *
 * For any number `n ≥ 1` of consecutive `signOut()` calls (with no
 * other auth actions in between), the resulting `authStore` value
 * equals the canonical signed-out state, no error is thrown, and
 * `stopRealtimeSync` and `resetConvexAuth` are each invoked at least
 * once.
 *
 * Mocked surfaces:
 *   - `$app/environment` — `browser: true` so the firebase module's
 *     init path runs.
 *   - `firebase/app` — `initializeApp` / `getApps` / `getApp` return
 *     stub app handles so the SDK is never contacted.
 *   - `firebase/auth` — `getAuth` returns a stub Auth, `signOut`
 *     records its calls, every other surface is a no-op so the import
 *     graph closes.
 *   - `$lib/cloud/convex` — `configureConvexAuth` is a no-op,
 *     `resetConvexAuth` records its calls.
 *   - `$lib/cloud/realtimeSync` — `stopRealtimeSync` records its calls.
 *
 * Validates: Property 6, Requirement 5.4
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { get } from 'svelte/store';

// ---------------------------------------------------------------------------
// Module mocks. All factories must be self-contained because vi.mock is
// hoisted above local declarations.
// ---------------------------------------------------------------------------

vi.mock('$app/environment', () => ({ browser: true }));

vi.mock('firebase/app', () => {
  const stubApp = { name: 'huntflow-test' };
  return {
    initializeApp: vi.fn(() => stubApp),
    getApps: vi.fn(() => []),
    getApp: vi.fn(() => stubApp)
  };
});

vi.mock('firebase/auth', () => {
  const auth: { currentUser: null } = { currentUser: null };
  return {
    getAuth: vi.fn(() => auth),
    onAuthStateChanged: vi.fn(),
    onIdTokenChanged: vi.fn(),
    getRedirectResult: vi.fn(async () => null),
    signInWithEmailAndPassword: vi.fn(async () => undefined),
    createUserWithEmailAndPassword: vi.fn(async () => undefined),
    sendEmailVerification: vi.fn(async () => undefined),
    sendPasswordResetEmail: vi.fn(async () => undefined),
    confirmPasswordReset: vi.fn(async () => undefined),
    applyActionCode: vi.fn(async () => undefined),
    signInWithPopup: vi.fn(async () => undefined),
    signInWithRedirect: vi.fn(async () => undefined),
    reauthenticateWithCredential: vi.fn(async () => undefined),
    reauthenticateWithPopup: vi.fn(async () => undefined),
    updateProfile: vi.fn(async () => undefined),
    deleteUser: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    GoogleAuthProvider: class {},
    GithubAuthProvider: class {},
    EmailAuthProvider: { credential: vi.fn(() => ({})) }
  };
});

vi.mock('$lib/cloud/convex', () => ({
  cloudConfigured: false,
  getConvexClient: vi.fn(() => null),
  getConvexHttpClient: vi.fn(() => null),
  configureConvexAuth: vi.fn(),
  resetConvexAuth: vi.fn(),
  cloudApi: {}
}));

vi.mock('$lib/cloud/realtimeSync', () => ({
  startRealtimeSync: vi.fn(),
  stopRealtimeSync: vi.fn(),
  realtimeSyncStore: { subscribe: () => () => undefined }
}));

// ---------------------------------------------------------------------------
// Imports of the module under test (after mocks above).
// ---------------------------------------------------------------------------

import * as firebaseAuth from 'firebase/auth';
import { authStore, signOut } from './firebase';
import { resetConvexAuth } from './convex';
import { stopRealtimeSync } from './realtimeSync';

const fbSignOutMock = firebaseAuth.signOut as ReturnType<typeof vi.fn>;
const stopRealtimeSyncMock = stopRealtimeSync as ReturnType<typeof vi.fn>;
const resetConvexAuthMock = resetConvexAuth as ReturnType<typeof vi.fn>;

beforeEach(() => {
  fbSignOutMock.mockClear();
  stopRealtimeSyncMock.mockClear();
  resetConvexAuthMock.mockClear();
});

afterEach(() => {
  // Reset the store between tests so an iteration's mutation can't
  // leak into the next.
  authStore.set({
    configured: true,
    loading: false,
    signedIn: true,
    convexAuthenticated: true,
    uid: 'pre-test-uid',
    email: 'pre-test@example.com',
    emailVerified: true,
    displayName: 'Pre Test',
    photoURL: '',
    providerIds: ['password'],
    isPro: true,
    error: 'a previous error'
  });
});

// Feature: firebase-auth-migration, Property 6: Sign-out is idempotent
describe('Property 6 — Sign-out is idempotent', () => {
  it('after n ≥ 1 consecutive signOut() calls the authStore equals the canonical signed-out state', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (n) => {
        // Start each iteration from a "signed-in" snapshot so the
        // signOut sequence has something to clear.
        authStore.set({
          configured: true,
          loading: false,
          signedIn: true,
          convexAuthenticated: true,
          uid: 'uid-active',
          email: 'active@example.com',
          emailVerified: true,
          displayName: 'Active User',
          photoURL: 'https://example.com/a.png',
          providerIds: ['password'],
          isPro: true,
          error: ''
        });
        fbSignOutMock.mockClear();
        stopRealtimeSyncMock.mockClear();
        resetConvexAuthMock.mockClear();

        for (let i = 0; i < n; i += 1) {
          await signOut();
        }

        const state = get(authStore);
        // Canonical signed-out state. `loading: false` because init has
        // already settled by the time signOut runs.
        expect(state).toEqual({
          configured: true,
          loading: false,
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
        });

        expect(stopRealtimeSyncMock.mock.calls.length).toBeGreaterThanOrEqual(1);
        expect(resetConvexAuthMock.mock.calls.length).toBeGreaterThanOrEqual(1);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('does not throw on any number of consecutive signOut() invocations', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (n) => {
        // Even if the firebase SDK signOut starts rejecting after the
        // first call (a hypothetical real-world quirk), our local
        // signOut should still settle the store. We don't simulate
        // that here because the contract under test is "no error
        // thrown" — the SDK mock resolves cleanly, which is enough.
        for (let i = 0; i < n; i += 1) {
          await signOut();
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });
});
