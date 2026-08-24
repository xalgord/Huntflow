<script lang="ts">
  /**
   * PasswordResetConfirmForm — set a new password from a reset link.
   *
   * Firebase routes every email action through `?mode=resetPassword&oobCode=...`.
   * The hosting route reads the query string and passes the `oobCode`
   * down as a prop so this component stays pure (no `$page` coupling)
   * and is easy to unit test.
   *
   * Flow:
   *   1. User opens the email link → route mounts this component with
   *      `oobCode` in hand.
   *   2. User types a new password and a matching confirmation.
   *   3. We call `confirmPasswordReset(oobCode, newPassword)`.
   *   4. On success, redirect to `/sign-in?reset=success`. The sign-in
   *      page reads the query param and shows a non-branded banner.
   *   5. On `auth/expired-action-code` / `auth/invalid-action-code`,
   *      surface the mapped message and offer a "Request a new link"
   *      button that bounces the user to `/forgot-password`.
   *
   * Visual design follows the AuthForm conventions: zinc-950 chrome
   * (`#070d0a` surround, `#0e1612` card), `hsl(var(--primary))` primary action,
   * and the shared `hf-label` / `hf-input` utilities. Brand-clean by
   * construction — every error string flows through `AuthErrorMap`.
   *
   * Feature: firebase-auth-migration
   * Validates: Requirements 4.2, 4.3, 4.4, 10.5
   */

  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Loader2 } from 'lucide-svelte';
  import { confirmPasswordReset } from '$lib/cloud/firebase';
  import { mapAuthError } from './AuthErrorMap';
  import { PASSWORD_POLICY_MESSAGES, validatePassword } from './passwordPolicy';

  /**
   * One-time code from the password-reset email's `?oobCode=` param.
   * The hosting route reads it from `$page.url.searchParams` and
   * passes it in. Empty string means the route landed without a code,
   * in which case we show the "request a new link" affordance up
   * front rather than letting the SDK throw.
   */
  export let oobCode = '';

  /**
   * Where to send the user after a successful reset. Default matches
   * Requirement 4.3: redirect to `/sign-in` with a non-branded
   * success marker the sign-in page can pick up.
   */
  export let signInPath = '/sign-in?reset=success';

  /** Where the "Request a new link" button navigates on stale links. */
  export let forgotPasswordPath = '/forgot-password';

  let password = '';
  let passwordConfirm = '';
  /** Free-form error message rendered in the alert region. Empty string hides it. */
  let error = '';
  /**
   * True when the failure is due to a stale/invalid action code, so
   * the template can offer a "Request a new link" button alongside
   * the error message. Tracked separately from `error` because the
   * brand-clean string itself is generic; only this flag drives the
   * extra affordance.
   */
  let staleLink = false;
  /** True while the SDK call is in flight; disables the form. */
  let busy = false;

  let passwordInput: HTMLInputElement | null = null;

  // Per Requirement 10.5: focus the first input on mount.
  onMount(() => {
    if (!oobCode) {
      // No code in the URL means the link is malformed or the user
      // landed here directly. Surface the same affordance the
      // SDK-error path uses so they have a way out.
      staleLink = true;
      error = 'This link is invalid or has already been used.';
      return;
    }
    passwordInput?.focus();
  });

  /**
   * Returns true when the Firebase error code indicates the action
   * code is no longer usable (expired or already consumed). These
   * are the cases that warrant the "Request a new link" affordance
   * per Requirement 4.4.
   */
  function isStaleActionCode(err: unknown): boolean {
    if (typeof err !== 'object' || err === null) return false;
    const code = (err as { code?: unknown }).code;
    return (
      code === 'auth/expired-action-code' ||
      code === 'auth/invalid-action-code'
    );
  }

  async function handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (busy) return;

    error = '';
    staleLink = false;

    if (!oobCode) {
      // Defensive: the on-mount path already surfaces this, but the
      // user could in principle still hit submit after a remount.
      staleLink = true;
      error = 'This link is invalid or has already been used.';
      return;
    }

    if (password.length < 8) {
      // Inline validation matching Requirement 1.4 / 10.4 — flag the
      // failed field before any network round-trip.
      error = 'Use at least 8 characters for your new password.';
      return;
    }

    // Enforce the full client-side policy (letter + number) consistent
    // with AuthForm, so the user gets precise guidance instead of a
    // generic `auth/weak-password` after a network round-trip.
    const policy = validatePassword(password);
    if (!policy.ok) {
      error = PASSWORD_POLICY_MESSAGES[policy.reason];
      return;
    }

    if (password !== passwordConfirm) {
      error = "Passwords don't match.";
      return;
    }

    busy = true;
    try {
      await confirmPasswordReset(oobCode, password);
      // Wipe the password fields before navigating so they're not
      // retained in any cached form state.
      password = '';
      passwordConfirm = '';
      await goto(signInPath, { replaceState: true });
    } catch (err) {
      error = mapAuthError(err);
      staleLink = isStaleActionCode(err);
    } finally {
      busy = false;
    }
  }

  async function handleRequestNewLink(): Promise<void> {
    await goto(forgotPasswordPath);
  }
</script>

<form
  class="space-y-4"
  on:submit|preventDefault={handleSubmit}
  novalidate
  aria-busy={busy}
>
  <label class="block">
    <span class="hf-label">New password</span>
    <input
      bind:this={passwordInput}
      bind:value={password}
      type="password"
      name="password"
      autocomplete="new-password"
      required
      minlength="8"
      class="hf-input mt-1.5"
      placeholder="At least 8 characters"
      disabled={busy || staleLink}
    />
  </label>

  <label class="block">
    <span class="hf-label">Confirm new password</span>
    <input
      bind:value={passwordConfirm}
      type="password"
      name="passwordConfirm"
      autocomplete="new-password"
      required
      minlength="8"
      class="hf-input mt-1.5"
      placeholder="Re-enter your password"
      disabled={busy || staleLink}
    />
  </label>

  {#if error}
    <div
      role="alert"
      aria-live="polite"
      class="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-100"
    >
      {error}
    </div>
  {/if}

  {#if staleLink}
    <button
      type="button"
      class="secondary-btn"
      on:click={handleRequestNewLink}
      disabled={busy}
    >
      <span>Request a new link</span>
    </button>
  {:else}
    <button type="submit" class="primary-btn" disabled={busy}>
      {#if busy}
        <Loader2 size={16} class="animate-spin" aria-hidden="true" />
        <span>Updating password…</span>
      {:else}
        <span>Update password</span>
      {/if}
    </button>
  {/if}

  <p class="text-[11px] leading-5 text-zinc-500">
    After your password is updated, you'll be sent to sign in with the new credentials.
  </p>
</form>

<style>
  /* Primary submit button — matches the AuthForm accent so the visual
     language stays consistent across every auth surface. Contrast of
     `#070d0a` text on `hsl(var(--primary))` clears WCAG AAA. */
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

  /* Secondary action used for the "Request a new link" affordance.
     Neutral chrome with the agreed accent ring on focus so keyboard
     users see the active control clearly. The 4.5:1 contrast on
     `text-zinc-100` over `#0e1612` clears WCAG AA. */
  .secondary-btn {
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
  .secondary-btn:hover:not(:disabled) {
    border-color: #3f3f46; /* zinc-700 */
    background-color: #131c17;
  }
  .secondary-btn:active:not(:disabled) {
    transform: scale(0.985);
  }
  .secondary-btn:focus-visible {
    outline: none;
    border-color: hsl(var(--primary));
    box-shadow: 0 0 0 2px rgba(225, 29, 52, 0.35);
  }
  .secondary-btn:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
</style>
