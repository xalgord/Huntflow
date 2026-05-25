<script lang="ts">
  /**
   * EmailVerificationBanner — amber-tinted reminder banner that nudges
   * a freshly signed-up user to verify their email and offers a
   * one-click "Resend" affordance.
   *
   * Visibility predicate (per design):
   *   $authStore.signedIn === true && $authStore.emailVerified === false
   * Anything else hides the banner. The component ships no remote
   * scripts and no third-party badges, so it stays brand-clean by
   * construction.
   *
   * On click, "Resend" calls `resendVerificationEmail()` from the
   * AuthClient. Success surfaces a transient "Verification email
   * sent" message that auto-dismisses after ~4s. Errors flow through
   * `AuthErrorMap.mapAuthError` so the surfaced copy stays brand-
   * clean even when the SDK leaks a "Firebase:" prefix.
   *
   * Visual style: amber/yellow tinted banner over the existing dark
   * chrome, matched to the rest of HuntFlow's zinc-950 surface.
   *
   * Feature: firebase-auth-migration
   * Validates: Requirements 3.2, 3.3, 3.4
   */

  import { onDestroy } from 'svelte';
  import { CheckCircle2, Loader2, MailWarning } from 'lucide-svelte';
  import { authStore, resendVerificationEmail } from '$lib/cloud/firebase';
  import { mapAuthError } from './AuthErrorMap';

  /** Auto-dismiss the success message after this many ms. */
  const SUCCESS_TIMEOUT_MS = 4000;

  let busy = false;
  let success = false;
  let error = '';
  let successTimer: ReturnType<typeof setTimeout> | null = null;

  // Visibility predicate per design: only show for signed-in users who
  // haven't verified their email yet. Loading and signed-out states
  // both render nothing.
  $: visible = $authStore.signedIn === true && $authStore.emailVerified === false;

  function clearSuccessTimer(): void {
    if (successTimer !== null) {
      clearTimeout(successTimer);
      successTimer = null;
    }
  }

  async function handleResend(): Promise<void> {
    if (busy) return;
    error = '';
    success = false;
    clearSuccessTimer();
    busy = true;
    try {
      await resendVerificationEmail();
      success = true;
      successTimer = setTimeout(() => {
        success = false;
        successTimer = null;
      }, SUCCESS_TIMEOUT_MS);
    } catch (err) {
      error = mapAuthError(err);
    } finally {
      busy = false;
    }
  }

  onDestroy(() => {
    clearSuccessTimer();
  });
</script>

{#if visible}
  <aside
    role="status"
    aria-live="polite"
    class="ev-banner"
    data-testid="email-verification-banner"
  >
    <div class="ev-banner__icon" aria-hidden="true">
      <MailWarning size={18} />
    </div>
    <div class="ev-banner__copy">
      <p class="ev-banner__title">Verify your email</p>
      <p class="ev-banner__body">
        We sent a verification link to
        {#if $authStore.email}
          <span class="ev-banner__email">{$authStore.email}</span>.
        {:else}
          your inbox.
        {/if}
        Click it to confirm your address.
        {#if error}
          <span class="ev-banner__error" role="alert">{error}</span>
        {/if}
      </p>
    </div>
    <div class="ev-banner__actions">
      {#if success}
        <span class="ev-banner__sent" aria-live="polite">
          <CheckCircle2 size={14} aria-hidden="true" />
          Verification email sent
        </span>
      {:else}
        <button
          type="button"
          class="ev-banner__resend"
          on:click={handleResend}
          disabled={busy}
        >
          {#if busy}
            <Loader2 size={14} class="animate-spin" aria-hidden="true" />
            <span>Sending…</span>
          {:else}
            <span>Resend</span>
          {/if}
        </button>
      {/if}
    </div>
  </aside>
{/if}

<style>
  /* Banner, not a card: full-width amber-tinted strip that sits above
     existing surface chrome. Border + tint stay subtle so the banner
     reads as informational rather than alarming. Contrast of
     `text-amber-50` on the tinted surface clears WCAG AA at 4.5:1. */
  .ev-banner {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    width: 100%;
    border-radius: 0.625rem;
    border: 1px solid rgba(251, 191, 36, 0.28); /* amber-400 @ 28% */
    background-color: rgba(120, 53, 15, 0.18); /* amber-900 @ 18% over zinc-950 */
    padding: 0.75rem 1rem;
    color: #fef3c7; /* amber-50 */
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  .ev-banner__icon {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    margin-top: 0.125rem;
    color: #fbbf24; /* amber-400 */
  }

  .ev-banner__copy {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .ev-banner__title {
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.005em;
    color: #fde68a; /* amber-200 */
    margin: 0;
  }

  .ev-banner__body {
    font-size: 0.8125rem;
    line-height: 1.45;
    color: #fef3c7; /* amber-50 */
    margin: 0;
  }

  .ev-banner__email {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
    font-size: 0.78125rem;
    color: #fff7ed;
    word-break: break-all;
  }

  .ev-banner__error {
    display: block;
    margin-top: 0.25rem;
    color: #fecaca; /* rose-200 — error stands out from the amber base */
  }

  .ev-banner__actions {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
  }

  .ev-banner__resend {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-height: 32px;
    padding: 0.375rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(251, 191, 36, 0.45);
    background-color: rgba(251, 191, 36, 0.12);
    color: #fde68a;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 150ms ease, border-color 150ms ease,
      transform 150ms ease;
  }

  .ev-banner__resend:hover:not(:disabled) {
    background-color: rgba(251, 191, 36, 0.2);
    border-color: rgba(251, 191, 36, 0.6);
  }

  .ev-banner__resend:active:not(:disabled) {
    transform: scale(0.97);
  }

  .ev-banner__resend:focus-visible {
    outline: none;
    border-color: #fbbf24;
    box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.45);
  }

  .ev-banner__resend:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .ev-banner__sent {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-height: 32px;
    padding: 0.375rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(74, 222, 128, 0.35); /* green-400 @ 35% */
    background-color: rgba(34, 197, 94, 0.12); /* green-500 @ 12% */
    color: #bbf7d0; /* green-200 */
    font-size: 0.8125rem;
    font-weight: 500;
  }

  /* Stack the action onto its own row on narrow viewports so the copy
     doesn't get truncated by a side-by-side button. */
  @media (max-width: 480px) {
    .ev-banner {
      flex-wrap: wrap;
    }
    .ev-banner__actions {
      width: 100%;
      justify-content: flex-start;
      padding-left: 2rem; /* align under the copy */
    }
  }
</style>
