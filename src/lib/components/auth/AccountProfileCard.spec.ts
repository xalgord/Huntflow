// @vitest-environment jsdom
/**
 * Property 5 — AccountProfileCard rendering is total and brand-clean.
 *
 * Two property-shaped checks live here:
 *
 *   - Totality: for any AuthState where signedIn === true, rendering
 *     `AccountProfileCard` produces DOM that contains `email`,
 *     `displayName`, `photoURL` (when non-empty), each providerId
 *     mapped to a friendly name, and an emailVerified indicator.
 *
 *   - Brand-clean: across every Auth component (AuthForm,
 *     PasswordResetRequestForm, PasswordResetConfirmForm,
 *     EmailVerificationBanner, AccountProfileCard, AccountDeleteCard,
 *     SubscriptionCard, PlanCard), the rendered DOM does not contain
 *     any of the forbidden brand substrings ("Secured by",
 *     "Powered by Clerk", "Powered by Firebase", "clerk").
 *
 * The test mocks `$lib/cloud/firebase` so we can drive `authStore`
 * deterministically without booting the real Firebase SDK, and
 * mocks `$app/environment` / `$app/navigation` because every Auth
 * component imports through `$lib/cloud/firebase` (which itself
 * imports `$app/environment`).
 *
 * Tag (verbatim, immediately above the describe):
 *   // Feature: firebase-auth-migration, Property 5: AccountProfileCard rendering is total and brand-clean
 *
 * Validates: Property 5, Requirement 5.1, 5.5
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import type { Writable } from 'svelte/store';

// ---------------------------------------------------------------------------
// SvelteKit module mocks ($app/*) so component imports don't pull in the
// SvelteKit runtime.
// ---------------------------------------------------------------------------

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$app/navigation', () => ({
  goto: vi.fn(async () => undefined),
  invalidate: vi.fn(async () => undefined),
  invalidateAll: vi.fn(async () => undefined)
}));
vi.mock('$app/stores', async () => {
  const { writable } = await import('svelte/store');
  const page = writable({
    url: new URL('http://localhost/account'),
    params: {},
    route: { id: '/account' },
    status: 200,
    error: null,
    data: {},
    form: undefined
  });
  return { page };
});

// ---------------------------------------------------------------------------
// AuthState type (mirrors firebase.ts).
// ---------------------------------------------------------------------------

interface AuthState {
  configured: boolean;
  loading: boolean;
  signedIn: boolean;
  convexAuthenticated: boolean;
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  photoURL: string;
  providerIds: string[];
  isPro: boolean;
  error: string;
}

// Auth-client mock: a writable `authStore` plus no-op stubs for every
// callable the components import. The factory must avoid any top-level
// references because vi.mock is hoisted above local declarations.
vi.mock('$lib/cloud/firebase', async () => {
  const { writable } = await import('svelte/store');
  return {
    authStore: writable({
      configured: true,
      loading: false,
      signedIn: false,
      convexAuthenticated: false,
      uid: '',
      email: '',
      emailVerified: false,
      displayName: '',
      photoURL: '',
      providerIds: [] as string[],
      isPro: false,
      error: ''
    }),
    initFirebase: vi.fn(async () => null),
    signInWithEmailPassword: vi.fn(async () => undefined),
    signUpWithEmailPassword: vi.fn(async () => undefined),
    sendPasswordReset: vi.fn(async () => undefined),
    confirmPasswordReset: vi.fn(async () => undefined),
    applyEmailActionCode: vi.fn(async () => undefined),
    resendVerificationEmail: vi.fn(async () => undefined),
    signInWithGoogle: vi.fn(async () => undefined),
    signInWithGitHub: vi.fn(async () => undefined),
    updateDisplayName: vi.fn(async () => undefined),
    deleteAccount: vi.fn(async () => undefined),
    reauthenticate: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    getFirebaseIdToken: vi.fn(async () => null),
    refreshProEntitlement: vi.fn(async () => undefined)
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

// ---------------------------------------------------------------------------
// Imports of the components under test. These run AFTER the mocks above
// thanks to vi.mock hoisting.
// ---------------------------------------------------------------------------

import { render, cleanup } from '@testing-library/svelte';
import * as firebaseMock from '$lib/cloud/firebase';
import AccountProfileCard from './AccountProfileCard.svelte';
import AuthForm from './AuthForm.svelte';
import PasswordResetRequestForm from './PasswordResetRequestForm.svelte';
import PasswordResetConfirmForm from './PasswordResetConfirmForm.svelte';
import EmailVerificationBanner from './EmailVerificationBanner.svelte';
import AccountDeleteCard from './AccountDeleteCard.svelte';
import SubscriptionCard from './SubscriptionCard.svelte';
import PlanCard from './PlanCard.svelte';

// Type-narrow the mocked `authStore` to a Writable so tests can `set` it.
const mockAuthStore = firebaseMock.authStore as Writable<AuthState>;

const FORBIDDEN_BRAND_SUBSTRINGS = [
  'secured by',
  'powered by clerk',
  'powered by firebase',
  'clerk'
];

const FRIENDLY_PROVIDER_NAMES: Record<string, string> = {
  password: 'Email',
  'google.com': 'Google',
  'github.com': 'GitHub'
};

function friendlyProviderName(id: string): string {
  const known = FRIENDLY_PROVIDER_NAMES[id];
  if (known) return known;
  const dot = id.lastIndexOf('.');
  const stem = dot > 0 ? id.slice(0, dot) : id;
  if (stem.length === 0) return id;
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}

/**
 * Generator for a fully signed-in `AuthState`. Constrained values
 * keep the property check on the rendering invariant rather than
 * exercising the underlying Svelte runtime with surprises (e.g.
 * scripts in display name, which would be a separate concern).
 */
const authStateArb: fc.Arbitrary<AuthState> = fc.record({
  configured: fc.constant(true),
  loading: fc.constant(false),
  signedIn: fc.constant(true),
  convexAuthenticated: fc.boolean(),
  uid: fc.stringMatching(/^[A-Za-z0-9]{12,28}$/),
  email: fc.emailAddress(),
  emailVerified: fc.boolean(),
  displayName: fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s.trim().length > 0),
  photoURL: fc.option(
    fc
      .stringMatching(/^[a-z0-9]{4,16}$/)
      .map((slug) => `https://example.com/${slug}.png`),
    { nil: '' }
  ).map((v) => v ?? ''),
  providerIds: fc
    .uniqueArray(fc.constantFrom('password', 'google.com', 'github.com'), {
      minLength: 1,
      maxLength: 3
    }),
  isPro: fc.boolean(),
  error: fc.constant('')
});

// Generator for an arbitrary AuthState (signed-in or not). Used by the
// brand-clean property which must hold across every state.
const arbitraryAuthStateArb: fc.Arbitrary<AuthState> = fc.record({
  configured: fc.boolean(),
  loading: fc.boolean(),
  signedIn: fc.boolean(),
  convexAuthenticated: fc.boolean(),
  uid: fc.string({ maxLength: 24 }),
  email: fc.option(fc.emailAddress(), { nil: '' }).map((v) => v ?? ''),
  emailVerified: fc.boolean(),
  displayName: fc.string({ maxLength: 40 }),
  photoURL: fc.constant(''),
  providerIds: fc
    .uniqueArray(fc.constantFrom('password', 'google.com', 'github.com'), {
      maxLength: 3
    }),
  isPro: fc.boolean(),
  error: fc.string({ maxLength: 60 }).filter((s) => {
    const lower = s.toLowerCase();
    // Don't seed the brand-clean test with brand strings supplied via
    // `authStore.error` — the property is about what the components
    // render, not what arbitrary inputs contain.
    return !FORBIDDEN_BRAND_SUBSTRINGS.some((sub) => lower.includes(sub));
  })
});

afterEach(() => {
  cleanup();
});

// Feature: firebase-auth-migration, Property 5: AccountProfileCard rendering is total and brand-clean
describe('Property 5 — AccountProfileCard rendering is total and brand-clean', () => {
  beforeEach(() => {
    // Reset the store to a known baseline so failures in one iteration
    // don't bleed into the next.
    mockAuthStore.set({
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
  });

  it('renders email, displayName, photoURL (when set), provider chips, and an emailVerified indicator', () => {
    fc.assert(
      fc.property(authStateArb, (state) => {
        mockAuthStore.set(state);
        const { container, unmount } = render(AccountProfileCard);
        try {
          const text = container.textContent ?? '';
          // Email and display name appear verbatim.
          expect(text).toContain(state.email);
          expect(text).toContain(state.displayName);
          // photoURL surfaces as an <img src>.
          if (state.photoURL.length > 0) {
            const img = container.querySelector('img.avatar__img') as HTMLImageElement | null;
            expect(img).not.toBeNull();
            expect(img!.src).toBe(state.photoURL);
          }
          // Each providerId maps to a friendly name in the chips.
          for (const provider of state.providerIds) {
            expect(text).toContain(friendlyProviderName(provider));
          }
          // emailVerified indicator: either "Verified" or "Unverified".
          const indicator = state.emailVerified ? 'Verified' : 'Unverified';
          expect(text).toContain(indicator);
        } finally {
          unmount();
        }
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: firebase-auth-migration, Property 5: AccountProfileCard rendering is total and brand-clean
describe('Property 5 (companion) — every Auth component renders brand-clean DOM', () => {
  type ComponentEntry = {
    name: string;
    factory: () => { container: HTMLElement; unmount: () => void };
  };

  const components: ComponentEntry[] = [
    { name: 'AuthForm signIn', factory: () => render(AuthForm, { props: { mode: 'signIn' } }) },
    { name: 'AuthForm signUp', factory: () => render(AuthForm, { props: { mode: 'signUp' } }) },
    { name: 'PasswordResetRequestForm', factory: () => render(PasswordResetRequestForm) },
    {
      name: 'PasswordResetConfirmForm',
      factory: () =>
        render(PasswordResetConfirmForm, { props: { oobCode: 'abcdef1234' } })
    },
    { name: 'EmailVerificationBanner', factory: () => render(EmailVerificationBanner) },
    { name: 'AccountProfileCard', factory: () => render(AccountProfileCard) },
    { name: 'AccountDeleteCard', factory: () => render(AccountDeleteCard) },
    { name: 'SubscriptionCard', factory: () => render(SubscriptionCard) },
    { name: 'PlanCard', factory: () => render(PlanCard) }
  ];

  it('does not contain Secured by / Powered by Clerk / Powered by Firebase / clerk in any state', () => {
    fc.assert(
      fc.property(arbitraryAuthStateArb, (state) => {
        mockAuthStore.set(state);
        for (const { name, factory } of components) {
          const { container, unmount } = factory();
          try {
            const text = (container.textContent ?? '').toLowerCase();
            for (const needle of FORBIDDEN_BRAND_SUBSTRINGS) {
              if (text.includes(needle)) {
                throw new Error(
                  `${name} rendered forbidden substring "${needle}" with state ${JSON.stringify(state)}`
                );
              }
            }
          } finally {
            unmount();
          }
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });
});
