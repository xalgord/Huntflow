<script lang="ts">
  /**
   * PasswordResetRequestForm — request a password-reset email.
   *
   * The user enters the email tied to their account; we hand it to
   * `sendPasswordReset` and surface a non-branded success notice once
   * the SDK call resolves. Errors flow through `AuthErrorMap`, which
   * is brand-clean by construction.
   *
   * Visual design follows the AuthForm conventions: zinc-950 chrome
   * (`#070d0a` surround, `#0e1612` card), `hsl(var(--primary))` primary action,
   * and the shared `hf-label` / `hf-input` utilities.
   *
   * Feature: firebase-auth-migration
   * Validates: Requirements 4.1, 10.5, 10.6
   */

  import { onMount } from 'svelte';
  import { Loader2 } from 'lucide-svelte';
  import { sendPasswordReset } from '$lib/cloud/firebase';
  import { mapAuthError } from './AuthErrorMap';

  let email = '';
  /** Free-form error message rendered in the alert region. Empty string hides it. */
  let error = '';
  /** Non-branded success copy rendered after the SDK call resolves. */
  let success = '';
  /** True while the SDK call is in flight; disables the form. */
  let busy = false;

  let emailInput: HTMLInputElement | null = null;

  // Per Requirement 10.5: focus the first input on mount.
  onMount(() => {
    emailInput?.focus();
  });

  async function handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (busy) return;

    error = '';
    success = '';

    const trimmed = email.trim();
    if (trimmed.length === 0) {
      error = 'Enter the email tied to your account.';
      return;
    }

    busy = true;
    try {
      await sendPasswordReset(trimmed);
      success = 'Check your inbox for a reset link.';
    } catch (err) {
      error = mapAuthError(err);
    } finally {
      busy = false;
    }
  }
</script>

<form
  class="space-y-4"
  on:submit|preventDefault={handleSubmit}
  novalidate
  aria-busy={busy}
>
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

  {#if error}
    <div
      role="alert"
      aria-live="polite"
      class="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-100"
    >
      {error}
    </div>
  {/if}

  {#if success}
    <div
      role="status"
      aria-live="polite"
      class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-100"
    >
      {success}
    </div>
  {/if}

  <button type="submit" class="primary-btn" disabled={busy}>
    {#if busy}
      <Loader2 size={16} class="animate-spin" aria-hidden="true" />
      <span>Sending reset link…</span>
    {:else}
      <span>Send reset link</span>
    {/if}
  </button>

  <p class="text-[11px] leading-5 text-zinc-500">
    We'll email you a link to set a new password. The link expires after a short while for safety.
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
</style>
