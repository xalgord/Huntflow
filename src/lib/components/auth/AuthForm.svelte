<script lang="ts">
  /**
   * AuthForm — shared sign-in / sign-up shell.
   *
   * Renders an email + password form (with an extra password-confirm
   * field in sign-up mode), Google + GitHub OAuth buttons, an error
   * region, and a submit button. The component owns no auth state of
   * its own beyond the in-flight flags; success and failure are
   * surfaced through the central `authStore` (success) and the inline
   * error region (failure).
   *
   * Visual design follows the agreed zinc-950 palette: `#070d0a`
   * surround, `#0e1612` card, `hsl(var(--primary))` primary action. Every error
   * string flows through `AuthErrorMap.mapAuthError`, which is
   * brand-clean by construction (no "Clerk" / "Firebase" / "Secured
   * by" / "Powered by" leakage).
   *
   * Feature: firebase-auth-migration
   * Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 10.1, 10.2,
   *            10.4, 10.5, 10.6
   */

  import { onMount } from 'svelte';
  import { Github, Loader2 } from 'lucide-svelte';
  import {
    signInWithEmailPassword,
    signUpWithEmailPassword,
    signInWithGoogle,
    signInWithGitHub
  } from '$lib/cloud/firebase';
  import { mapAuthError } from './AuthErrorMap';
  import {
    PASSWORD_POLICY_MESSAGES,
    validatePassword
  } from './passwordPolicy';

  /** `signIn` renders the sign-in flow; `signUp` adds password-confirm + signup copy. */
  export let mode: 'signIn' | 'signUp' = 'signIn';

  let email = '';
  let password = '';
  let passwordConfirm = '';
  /** Free-form error message rendered in the alert region. Empty string hides the region. */
  let error = '';
  /** True while *any* submit (email or OAuth) is in flight; disables every button. */
  let busy = false;
  /** Tracks which provider is currently in flight so we can show its spinner only. */
  let activeProvider: 'email' | 'google' | 'github' | null = null;

  let emailInput: HTMLInputElement | null = null;

  // Per Requirement 10.5: focus the first input on mount.
  onMount(() => {
    emailInput?.focus();
  });

  $: submitLabel = mode === 'signUp' ? 'Create account' : 'Sign in';
  $: submitBusyLabel = mode === 'signUp' ? 'Creating account…' : 'Signing in…';

  async function handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (busy) return;

    error = '';

    if (mode === 'signUp' && password !== passwordConfirm) {
      // Inline validation (Requirement 1.4 / 10.4 — flag the failed
      // field before any network round-trip).
      error = "Passwords don't match.";
      return;
    }

    if (mode === 'signUp') {
      // Pre-submit password-policy check so the user sees the precise
      // rule that failed (matching the Firebase project's policy
      // recorded in runbook-firebase.md) instead of a generic
      // `auth/weak-password` after a network round-trip.
      const policy = validatePassword(password);
      if (!policy.ok) {
        error = PASSWORD_POLICY_MESSAGES[policy.reason];
        return;
      }
    }

    busy = true;
    activeProvider = 'email';
    try {
      if (mode === 'signUp') {
        await signUpWithEmailPassword(email.trim(), password);
      } else {
        await signInWithEmailPassword(email.trim(), password);
      }
      // The auth store handles redirect. Wipe the password fields so
      // the next mount of this form (e.g. after sign-out) is clean.
      password = '';
      passwordConfirm = '';
    } catch (err) {
      error = mapAuthError(err);
    } finally {
      busy = false;
      activeProvider = null;
    }
  }

  async function handleOAuth(provider: 'google' | 'github'): Promise<void> {
    if (busy) return;
    error = '';
    busy = true;
    activeProvider = provider;
    try {
      if (provider === 'google') {
        await signInWithGoogle();
      } else {
        await signInWithGitHub();
      }
    } catch (err) {
      error = mapAuthError(err);
    } finally {
      busy = false;
      activeProvider = null;
    }
  }
</script>

<form
  class="space-y-4"
  on:submit|preventDefault={handleSubmit}
  novalidate
  aria-busy={busy}
>
  <!-- OAuth providers come first: most users sign in with one. -->
  <div class="grid gap-2.5 sm:grid-cols-2">
    <button
      type="button"
      class="oauth-btn"
      on:click={() => handleOAuth('google')}
      disabled={busy}
      aria-label="Continue with Google"
    >
      {#if activeProvider === 'google'}
        <Loader2 size={16} class="animate-spin" aria-hidden="true" />
      {:else}
        <!-- Google "G" mark, drawn inline so we don't load remote scripts. -->
        <svg
          width="16"
          height="16"
          viewBox="0 0 18 18"
          aria-hidden="true"
          focusable="false"
        >
          <path
            fill="#4285F4"
            d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.614z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
          />
          <path
            fill="#FBBC05"
            d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
          />
        </svg>
      {/if}
      <span>Google</span>
    </button>

    <button
      type="button"
      class="oauth-btn"
      on:click={() => handleOAuth('github')}
      disabled={busy}
      aria-label="Continue with GitHub"
    >
      {#if activeProvider === 'github'}
        <Loader2 size={16} class="animate-spin" aria-hidden="true" />
      {:else}
        <Github size={16} aria-hidden="true" />
      {/if}
      <span>GitHub</span>
    </button>
  </div>

  <div class="flex items-center gap-3">
    <span class="h-px flex-1 bg-zinc-800" aria-hidden="true"></span>
    <span class="text-[11px] uppercase tracking-wider text-zinc-500">or with email</span>
    <span class="h-px flex-1 bg-zinc-800" aria-hidden="true"></span>
  </div>

  <label class="block">
    <span class="hf-label">Email</span>
    <input
      bind:this={emailInput}
      bind:value={email}
      type="email"
      name="email"
      autocomplete="email"
      required
      spellcheck="false"
      autocapitalize="off"
      class="hf-input mt-1.5"
      placeholder="you@example.com"
      disabled={busy}
    />
  </label>

  <label class="block">
    <div class="flex items-center justify-between">
      <span class="hf-label">Password</span>
      {#if mode === 'signIn'}
        <a
          href="/forgot-password"
          class="text-[11px] font-medium text-zinc-400 underline-offset-4 transition hover:text-emerald-300 hover:underline"
        >
          Forgot password?
        </a>
      {/if}
    </div>
    <input
      bind:value={password}
      type="password"
      name="password"
      autocomplete={mode === 'signUp' ? 'new-password' : 'current-password'}
      required
      minlength={mode === 'signUp' ? 8 : 1}
      class="hf-input mt-1.5"
      placeholder={mode === 'signUp' ? 'At least 8 characters' : 'Your password'}
      disabled={busy}
    />
  </label>

  {#if mode === 'signUp'}
    <label class="block">
      <span class="hf-label">Confirm password</span>
      <input
        bind:value={passwordConfirm}
        type="password"
        name="passwordConfirm"
        autocomplete="new-password"
        required
        minlength="8"
        class="hf-input mt-1.5"
        placeholder="Re-enter your password"
        disabled={busy}
      />
    </label>
  {/if}

  {#if error}
    <div
      role="alert"
      aria-live="polite"
      class="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-100"
    >
      {error}
    </div>
  {/if}

  <button
    type="submit"
    class="primary-btn"
    disabled={busy}
  >
    {#if activeProvider === 'email'}
      <Loader2 size={16} class="animate-spin" aria-hidden="true" />
      <span>{submitBusyLabel}</span>
    {:else}
      <span>{submitLabel}</span>
    {/if}
  </button>

  {#if mode === 'signUp'}
    <p class="text-[11px] leading-5 text-zinc-500">
      We'll send a verification link to your email. You can keep using HuntFlow while you confirm.
    </p>
  {/if}
</form>

<style>
  /* OAuth provider button — neutral chrome with an accent ring on
     focus. The 4.5:1 contrast on `text-zinc-100` over `#0e1612` clears
     WCAG AA for text and the focus ring uses the agreed primary green
     so keyboard users see the active control clearly. */
  .oauth-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 44px;
    width: 100%;
    border-radius: 0.5rem;
    border: 1px solid #27272a; /* zinc-800 */
    background-color: #0e1612;
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #fafafa; /* zinc-50 */
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    transition: border-color 150ms ease, background-color 150ms ease, transform 150ms ease;
    cursor: pointer;
  }
  .oauth-btn:hover:not(:disabled) {
    border-color: #3f3f46; /* zinc-700 */
    background-color: #131c17;
  }
  .oauth-btn:active:not(:disabled) {
    transform: scale(0.985);
  }
  .oauth-btn:focus-visible {
    outline: none;
    border-color: hsl(var(--primary));
    box-shadow: 0 0 0 2px rgba(225, 29, 52, 0.35);
  }
  .oauth-btn:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  /* Primary submit button — saturated green that matches the agreed
     accent. Contrast of `#070d0a` text on `hsl(var(--primary))` is ~13:1, well
     past WCAG AAA. */
  .primary-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 44px;
    width: 100%;
    border-radius: 0.5rem;
    background-color: hsl(var(--primary));
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #ffffff;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06), 0 8px 24px rgba(225, 29, 52, 0.18);
    transition: background-color 150ms ease, transform 150ms ease, box-shadow 150ms ease;
    cursor: pointer;
  }
  .primary-btn:hover:not(:disabled) {
    background-color: #c81530;
  }
  .primary-btn:active:not(:disabled) {
    transform: scale(0.985);
  }
  .primary-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(225, 29, 52, 0.55), 0 8px 24px rgba(225, 29, 52, 0.25);
  }
  .primary-btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
    box-shadow: none;
  }
</style>
