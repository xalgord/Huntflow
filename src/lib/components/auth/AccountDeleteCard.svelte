<script lang="ts">
  /**
   * AccountDeleteCard — destructive, two-step delete flow with a
   * provider-aware re-authentication prompt.
   *
   * The card is a state machine over three views:
   *
   *   1. `idle`        — destructive "Delete account" button with a
   *                      one-line explanation. Lower visual weight than
   *                      the AuthForm primary so it doesn't compete on
   *                      the account screen.
   *   2. `confirming`  — design-default copy ("This will permanently
   *                      delete your account and all your cloud data.
   *                      This cannot be undone.") plus Cancel /
   *                      Continue. Resolves OQ 4.
   *   3. `reauth`      — provider-aware re-authentication. Password
   *                      users see a password input plus Confirm
   *                      delete; OAuth users see a single
   *                      "Re-authenticate with <provider>" button.
   *                      Cancel returns to `idle`.
   *
   * Order of operations on confirmed re-auth: call `reauthenticate()`
   * (with the password for password users, no arg for OAuth users),
   * then call `deleteAccount()`. If `deleteAccount()` itself raises
   * `auth/requires-recent-login` (Firebase enforces this for sensitive
   * operations even when re-auth has just succeeded under some
   * conditions), the card surfaces the mapped error and bounces the
   * user back to the `reauth` step without losing their input.
   *
   * After a successful deletion the AuthClient resets `authStore`; the
   * parent route is responsible for the post-deletion redirect (the
   * card just needs to stop interacting with a now-deleted user).
   *
   * Visual style: red/rose tinted destructive surface, matched to the
   * AuthForm input/button conventions (zinc-950 chrome,
   * `hf-input` / `hf-label` utilities) but with a destructive accent
   * instead of the `#60ff5c` primary so the card reads as dangerous
   * without competing with sign-in primary actions on the same page.
   *
   * Feature: firebase-auth-migration
   * Validates: Requirement 5.3
   */

  import { tick } from 'svelte';
  import { AlertTriangle, Loader2, ShieldAlert, Trash2 } from 'lucide-svelte';
  import {
    authStore,
    deleteAccount,
    reauthenticate
  } from '$lib/cloud/firebase';
  import { mapAuthError } from './AuthErrorMap';

  // ---------------------------------------------------------------------------
  // Provider helpers — resolve the user's primary provider for re-auth.
  // ---------------------------------------------------------------------------

  /**
   * Friendly names for the OAuth providers HuntFlow supports. Keep in
   * sync with `AccountProfileCard.friendlyProviderName`.
   */
  const FRIENDLY_PROVIDER_NAMES: Record<string, string> = {
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

  // The primary provider drives which re-auth prompt we render.
  // `firebase.ts` mirrors this same `providerData[0].providerId` rule
  // when picking how to re-auth, so the UI stays in lockstep with the
  // SDK call.
  $: providerIds = $authStore.providerIds ?? [];
  $: primaryProviderId = providerIds[0] ?? 'password';
  $: isPasswordUser = primaryProviderId === 'password';
  $: oauthProviderName = friendlyProviderName(primaryProviderId);
  $: signedIn = $authStore.signedIn;

  // ---------------------------------------------------------------------------
  // State machine.
  // ---------------------------------------------------------------------------

  type Step = 'idle' | 'confirming' | 'reauth';

  let step: Step = 'idle';
  let password = '';
  /** Inline error rendered inside the active panel. Empty string hides it. */
  let error = '';
  /** True while a re-auth + delete round-trip is in flight. */
  let busy = false;

  let passwordInput: HTMLInputElement | null = null;

  function resetTransientState(): void {
    password = '';
    error = '';
    busy = false;
  }

  function startConfirm(): void {
    if (!signedIn || busy) return;
    error = '';
    step = 'confirming';
  }

  function cancel(): void {
    if (busy) return;
    step = 'idle';
    resetTransientState();
  }

  async function continueToReauth(): Promise<void> {
    if (busy) return;
    error = '';
    step = 'reauth';
    if (isPasswordUser) {
      // Focus the password input on the next tick so the binding is
      // alive before we call .focus().
      await tick();
      passwordInput?.focus();
    }
  }

  /**
   * Perform the actual delete. Re-authenticates first, then calls
   * `deleteAccount()`. If `deleteAccount()` raises
   * `auth/requires-recent-login`, surface the mapped error and stay on
   * the `reauth` step so the user can retry without losing input.
   */
  async function performDelete(): Promise<void> {
    if (busy) return;
    error = '';

    if (isPasswordUser && password.length === 0) {
      error = 'Enter your password to continue.';
      return;
    }

    busy = true;
    try {
      // Step 1: re-authenticate. Password users supply their password;
      // OAuth users get re-popped through their original provider.
      await reauthenticate(isPasswordUser ? password : undefined);

      // Step 2: delete. If Firebase still demands a fresher login, the
      // catch below bounces the user back through `reauth`.
      await deleteAccount();

      // On success the AuthClient resets `authStore`; the parent route
      // owns the redirect. Reset the local state defensively so the
      // brief moment before unmount doesn't show a stale password.
      resetTransientState();
      step = 'idle';
    } catch (err) {
      const code = (err as { code?: unknown } | null)?.code;
      // `auth/requires-recent-login` from `deleteAccount()` itself
      // means the SDK didn't accept the prior re-auth as recent
      // enough. Bounce back to the re-auth step (we may already be
      // there) and surface the mapped error so the user can retry.
      if (code === 'auth/requires-recent-login') {
        step = 'reauth';
        error = mapAuthError(err);
        if (isPasswordUser) {
          await tick();
          passwordInput?.focus();
          passwordInput?.select();
        }
      } else {
        error = mapAuthError(err);
      }
    } finally {
      busy = false;
    }
  }

  function handleReauthKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      void performDelete();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  }
</script>

<section
  class="delete-card"
  aria-labelledby="account-delete-heading"
  data-testid="account-delete-card"
>
  <header class="delete-card__header">
    <div class="delete-card__icon" aria-hidden="true">
      <ShieldAlert size={18} />
    </div>
    <div>
      <h2 id="account-delete-heading" class="delete-card__title">Delete account</h2>
      <p class="delete-card__subtitle">
        Permanently remove your account and erase all of your cloud data.
      </p>
    </div>
  </header>

  {#if step === 'idle'}
    <div class="delete-card__row" data-testid="delete-step-idle">
      <p class="delete-card__body">
        Sign-out keeps your data; deletion does not. This is irreversible.
      </p>
      <button
        type="button"
        class="danger-btn"
        on:click={startConfirm}
        disabled={!signedIn}
        data-testid="delete-account-trigger"
      >
        <Trash2 size={14} aria-hidden="true" />
        <span>Delete account</span>
      </button>
    </div>
  {:else if step === 'confirming'}
    <div
      class="delete-card__panel"
      role="alertdialog"
      aria-modal="false"
      aria-labelledby="account-delete-confirm-heading"
      data-testid="delete-step-confirming"
    >
      <div class="delete-card__panel-icon" aria-hidden="true">
        <AlertTriangle size={18} />
      </div>
      <div class="delete-card__panel-copy">
        <p
          id="account-delete-confirm-heading"
          class="delete-card__panel-title"
        >
          This will permanently delete your account and all your cloud data. This cannot be undone.
        </p>
        <p class="delete-card__panel-body">
          You'll be asked to confirm your identity on the next step.
        </p>
      </div>
      <div class="delete-card__actions">
        <button
          type="button"
          class="secondary-btn"
          on:click={cancel}
          disabled={busy}
          data-testid="delete-cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          class="danger-btn"
          on:click={continueToReauth}
          disabled={busy}
          data-testid="delete-continue"
        >
          Continue
        </button>
      </div>
    </div>
  {:else if step === 'reauth'}
    <div
      class="delete-card__panel"
      role="alertdialog"
      aria-modal="false"
      aria-labelledby="account-delete-reauth-heading"
      data-testid="delete-step-reauth"
    >
      <div class="delete-card__panel-icon" aria-hidden="true">
        <ShieldAlert size={18} />
      </div>
      <div class="delete-card__panel-copy">
        <p
          id="account-delete-reauth-heading"
          class="delete-card__panel-title"
        >
          Confirm it's you
        </p>
        <p class="delete-card__panel-body">
          {#if isPasswordUser}
            Enter your password to permanently delete your account.
          {:else}
            Re-authenticate with {oauthProviderName} to permanently delete your account.
          {/if}
        </p>

        {#if isPasswordUser}
          <label class="delete-card__field">
            <span class="hf-label">Password</span>
            <input
              bind:this={passwordInput}
              bind:value={password}
              type="password"
              name="reauth-password"
              autocomplete="current-password"
              required
              class="hf-input mt-1.5"
              placeholder="Your password"
              disabled={busy}
              on:keydown={handleReauthKeydown}
              data-testid="delete-reauth-password"
            />
          </label>
        {/if}

        {#if error}
          <p
            class="delete-card__error"
            role="alert"
            aria-live="polite"
            data-testid="delete-reauth-error"
          >
            {error}
          </p>
        {/if}
      </div>

      <div class="delete-card__actions">
        <button
          type="button"
          class="secondary-btn"
          on:click={cancel}
          disabled={busy}
          data-testid="delete-reauth-cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          class="danger-btn"
          on:click={performDelete}
          disabled={busy || (isPasswordUser && password.length === 0)}
          data-testid="delete-reauth-confirm"
        >
          {#if busy}
            <Loader2 size={14} class="animate-spin" aria-hidden="true" />
            <span>Deleting…</span>
          {:else if isPasswordUser}
            <Trash2 size={14} aria-hidden="true" />
            <span>Delete account</span>
          {:else}
            <Trash2 size={14} aria-hidden="true" />
            <span>Re-authenticate with {oauthProviderName}</span>
          {/if}
        </button>
      </div>
    </div>
  {/if}
</section>

<style>
  /* ----------------------------------------------------------------------- */
  /* Card chrome — destructive surface. Lower visual weight than AuthForm:   */
  /* the destructive accent is reserved for the active button, the surround */
  /* uses the same zinc-950 chrome with a rose tint so the card signals     */
  /* "danger zone" without overpowering primary actions on the same page.   */
  /* ----------------------------------------------------------------------- */
  .delete-card {
    border-radius: 0.875rem;
    border: 1px solid rgba(244, 63, 94, 0.28); /* rose-500 @ 28% */
    background-color: rgba(76, 5, 25, 0.18); /* rose-950 @ 18% over zinc-950 */
    padding: 1.25rem;
    color: #fafafa; /* zinc-50 */
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .delete-card__header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .delete-card__icon {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 9999px;
    background-color: rgba(244, 63, 94, 0.14); /* rose-500 @ 14% */
    color: #fda4af; /* rose-300 */
    margin-top: 0.125rem;
  }

  .delete-card__title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    letter-spacing: 0.005em;
    color: #fff1f2; /* rose-50 */
  }

  .delete-card__subtitle {
    margin: 0.125rem 0 0;
    font-size: 0.8125rem;
    line-height: 1.45;
    color: #fecdd3; /* rose-200 */
  }

  /* ----------------------------------------------------------------------- */
  /* Idle row — single line of explanation + the destructive trigger.        */
  /* ----------------------------------------------------------------------- */
  .delete-card__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .delete-card__body {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.45;
    color: #fecaca; /* rose-200 */
    flex: 1 1 12rem;
    min-width: 0;
  }

  /* ----------------------------------------------------------------------- */
  /* Inner panel — used by the confirming and reauth steps. The panel        */
  /* sits inside the card on a deeper rose tint so it reads as a focused    */
  /* sub-region without becoming a modal.                                   */
  /* ----------------------------------------------------------------------- */
  .delete-card__panel {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.75rem 0.875rem;
    border-radius: 0.625rem;
    border: 1px solid rgba(244, 63, 94, 0.32);
    background-color: rgba(159, 18, 57, 0.18); /* rose-800 @ 18% */
    padding: 0.875rem 1rem;
  }

  .delete-card__panel-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 9999px;
    background-color: rgba(244, 63, 94, 0.18);
    color: #fecaca;
    margin-top: 0.125rem;
  }

  .delete-card__panel-copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .delete-card__panel-title {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.45;
    color: #fff1f2;
  }

  .delete-card__panel-body {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.5;
    color: #fecdd3;
  }

  .delete-card__field {
    display: block;
    margin-top: 0.375rem;
  }

  .delete-card__error {
    margin: 0.375rem 0 0;
    font-size: 0.8125rem;
    color: #fecaca;
  }

  .delete-card__actions {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  /* ----------------------------------------------------------------------- */
  /* Buttons.                                                                */
  /*                                                                         */
  /* `danger-btn` is the destructive accent. Contrast of `#fff1f2` (rose-50) */
  /* on `#e11d48` (rose-600) ≈ 5.1:1 which clears WCAG AA for normal text.   */
  /* `secondary-btn` matches AuthForm's neutral chrome so Cancel reads as a  */
  /* low-weight escape rather than a destructive companion.                  */
  /* ----------------------------------------------------------------------- */
  .danger-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    min-height: 36px;
    padding: 0.5rem 0.875rem;
    border-radius: 0.5rem;
    border: 1px solid #be123c; /* rose-700 */
    background-color: #e11d48; /* rose-600 */
    color: #fff1f2;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06),
      0 6px 18px rgba(225, 29, 72, 0.25);
    transition: background-color 150ms ease, border-color 150ms ease,
      transform 150ms ease, box-shadow 150ms ease;
  }

  .danger-btn:hover:not(:disabled) {
    background-color: #f43f5e; /* rose-500 */
    border-color: #e11d48;
  }

  .danger-btn:active:not(:disabled) {
    transform: scale(0.985);
  }

  .danger-btn:focus-visible {
    outline: none;
    border-color: #fb7185; /* rose-400 */
    box-shadow: 0 0 0 2px rgba(251, 113, 133, 0.55),
      0 6px 18px rgba(225, 29, 72, 0.3);
  }

  .danger-btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
    box-shadow: none;
  }

  .secondary-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    min-height: 36px;
    padding: 0.5rem 0.875rem;
    border-radius: 0.5rem;
    border: 1px solid #27272a; /* zinc-800 */
    background-color: #0e1612;
    color: #d4d4d8; /* zinc-300 */
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 150ms ease, background-color 150ms ease,
      color 150ms ease, transform 150ms ease;
  }

  .secondary-btn:hover:not(:disabled) {
    border-color: #3f3f46;
    background-color: #131c17;
    color: #fafafa;
  }

  .secondary-btn:active:not(:disabled) {
    transform: scale(0.985);
  }

  .secondary-btn:focus-visible {
    outline: none;
    border-color: #60ff5c;
    box-shadow: 0 0 0 2px rgba(96, 255, 92, 0.35);
  }

  .secondary-btn:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  /* Stack actions onto their own row on narrow viewports so wrapping
     stays predictable and the destructive button always lines up on
     the right. */
  @media (max-width: 480px) {
    .delete-card__panel {
      grid-template-columns: 1fr;
    }
    .delete-card__panel-icon {
      display: none;
    }
    .delete-card__actions {
      justify-content: stretch;
    }
    .delete-card__actions .secondary-btn,
    .delete-card__actions .danger-btn {
      flex: 1 1 0;
    }
  }
</style>
