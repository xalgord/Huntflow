<script lang="ts">
  /**
   * AccountProfileCard — read/edit panel for the current user's profile.
   *
   * Renders, against the live `authStore`:
   *   - Avatar (img when `photoURL` is non-empty, otherwise an initials
   *     fallback over a zinc-800 surface).
   *   - Display name with a pencil-icon "Edit" affordance that swaps the
   *     read-only label for a text input plus Save / Cancel buttons.
   *     Save calls `updateDisplayName(trimmed)`; on success the local
   *     state collapses back to read-only.
   *   - Primary email (read-only).
   *   - Email-verification indicator: green checkmark when verified,
   *     amber warning chip when not (works in tandem with the
   *     `EmailVerificationBanner` — this is the inline indicator within
   *     the card).
   *   - Provider list, each `providerIds[i]` mapped to a brand-clean
   *     friendly name (`'password'` → "Email", `'google.com'` → "Google",
   *     `'github.com'` → "GitHub"; anything else passes through with the
   *     trailing `.tld` stripped and the first letter capitalized).
   *
   * Errors raised by `updateDisplayName` flow through
   * `AuthErrorMap.mapAuthError` so the surfaced copy stays brand-clean
   * even when the SDK leaks a "Firebase:" prefix. The component renders
   * no third-party badge text, no remote scripts, and matches the
   * AuthForm visual conventions (zinc-950 chrome, `#60ff5c` accent,
   * `hf-input` / `hf-label` utilities, focus ring on accent green).
   *
   * Resolves OQ 4 inline at the wider Account flow level: the destructive
   * delete copy lives on `AccountDeleteCard`; this card just owns
   * profile fields.
   *
   * Feature: firebase-auth-migration
   * Validates: Requirements 5.1, 5.2, 10.1, 10.2, 10.6
   */

  import { tick } from 'svelte';
  import {
    BadgeCheck,
    Check,
    Loader2,
    Pencil,
    ShieldAlert,
    X
  } from 'lucide-svelte';
  import { authStore, updateDisplayName } from '$lib/cloud/firebase';
  import { mapAuthError } from './AuthErrorMap';

  // ---------------------------------------------------------------------------
  // Provider-id → friendly-name mapping.
  //
  // The well-known IDs used by HuntFlow's auth surface are listed
  // explicitly so the brand capitalization ("GitHub", not "Github") is
  // preserved. Anything else — defensively, a future provider we
  // haven't wired yet — is passed through with the trailing `.tld`
  // stripped and the first letter capitalized.
  // ---------------------------------------------------------------------------

  const FRIENDLY_PROVIDER_NAMES: Record<string, string> = {
    password: 'Email',
    'google.com': 'Google',
    'github.com': 'GitHub'
  };

  function friendlyProviderName(id: string): string {
    const known = FRIENDLY_PROVIDER_NAMES[id];
    if (known) return known;
    // Strip the rightmost `.tld` segment; if there isn't one, keep the
    // raw id. Then capitalize the first letter so it reads as a name.
    const dot = id.lastIndexOf('.');
    const stem = dot > 0 ? id.slice(0, dot) : id;
    if (stem.length === 0) return id;
    return stem.charAt(0).toUpperCase() + stem.slice(1);
  }

  // ---------------------------------------------------------------------------
  // Derived display values from the auth store.
  // ---------------------------------------------------------------------------

  $: signedIn = $authStore.signedIn;
  $: email = $authStore.email;
  $: displayName = $authStore.displayName;
  $: photoURL = $authStore.photoURL;
  $: emailVerified = $authStore.emailVerified;
  $: providerIds = $authStore.providerIds ?? [];

  /**
   * The avatar fallback initial. Prefers the first non-whitespace
   * character of the display name, falling back to the email's local
   * part, then to a generic placeholder. Always returns a single
   * uppercase character.
   */
  $: avatarInitial = ((): string => {
    const fromName = displayName.trim().charAt(0);
    if (fromName) return fromName.toUpperCase();
    const fromEmail = email.trim().charAt(0);
    if (fromEmail) return fromEmail.toUpperCase();
    return '?';
  })();

  // ---------------------------------------------------------------------------
  // Display-name edit state.
  // ---------------------------------------------------------------------------

  let editing = false;
  let draftName = '';
  let saving = false;
  let editError = '';
  let nameInput: HTMLInputElement | null = null;

  async function beginEdit(): Promise<void> {
    if (!signedIn || saving) return;
    draftName = displayName;
    editError = '';
    editing = true;
    // Focus the input on the next tick so the binding is alive before
    // we touch it.
    await tick();
    nameInput?.focus();
    nameInput?.select();
  }

  function cancelEdit(): void {
    if (saving) return;
    editing = false;
    editError = '';
    draftName = '';
  }

  async function commitEdit(): Promise<void> {
    if (saving) return;
    const trimmed = draftName.trim();
    if (trimmed.length === 0) {
      editError = 'Display name cannot be empty.';
      return;
    }
    if (trimmed === displayName) {
      // No-op save: just collapse the editor.
      editing = false;
      editError = '';
      return;
    }
    saving = true;
    editError = '';
    try {
      await updateDisplayName(trimmed);
      editing = false;
      draftName = '';
    } catch (err) {
      editError = mapAuthError(err);
    } finally {
      saving = false;
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      void commitEdit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
    }
  }
</script>

<section
  class="profile-card"
  aria-labelledby="account-profile-heading"
  data-testid="account-profile-card"
>
  <header class="profile-card__header">
    <h2 id="account-profile-heading" class="profile-card__title">Profile</h2>
    <p class="profile-card__subtitle">
      Your name and avatar appear next to anything you publish.
    </p>
  </header>

  <div class="profile-card__body">
    <!-- Avatar: real image when photoURL is set, initials fallback otherwise. -->
    <div class="avatar" aria-hidden={photoURL ? 'true' : 'false'}>
      {#if photoURL}
        <img
          src={photoURL}
          alt="{displayName || email || 'Account'} avatar"
          class="avatar__img"
          referrerpolicy="no-referrer"
          loading="lazy"
        />
      {:else}
        <span class="avatar__initial" aria-label="{displayName || email || 'Account'} avatar">
          {avatarInitial}
        </span>
      {/if}
    </div>

    <div class="profile-card__fields">
      <!-- Display name: read-only label with pencil affordance, or input + Save/Cancel when editing. -->
      <div class="field">
        <span class="hf-label">Display name</span>
        {#if !editing}
          <div class="field__row">
            <span class="field__value" data-testid="profile-display-name">
              {displayName || 'Not set'}
            </span>
            <button
              type="button"
              class="icon-btn"
              on:click={beginEdit}
              disabled={!signedIn || saving}
              aria-label="Edit display name"
            >
              <Pencil size={14} aria-hidden="true" />
              <span>Edit</span>
            </button>
          </div>
        {:else}
          <div class="field__edit">
            <input
              bind:this={nameInput}
              bind:value={draftName}
              type="text"
              name="displayName"
              autocomplete="name"
              class="hf-input mt-1.5"
              placeholder="How should we address you?"
              maxlength="80"
              disabled={saving}
              on:keydown={handleKeydown}
            />
            <div class="field__edit-actions">
              <button
                type="button"
                class="primary-btn"
                on:click={commitEdit}
                disabled={saving}
              >
                {#if saving}
                  <Loader2 size={14} class="animate-spin" aria-hidden="true" />
                  <span>Saving…</span>
                {:else}
                  <Check size={14} aria-hidden="true" />
                  <span>Save</span>
                {/if}
              </button>
              <button
                type="button"
                class="secondary-btn"
                on:click={cancelEdit}
                disabled={saving}
              >
                <X size={14} aria-hidden="true" />
                <span>Cancel</span>
              </button>
            </div>
            {#if editError}
              <p
                class="field__error"
                role="alert"
                aria-live="polite"
                data-testid="profile-display-name-error"
              >
                {editError}
              </p>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Email: read-only with an inline verification indicator. -->
      <div class="field">
        <span class="hf-label">Email</span>
        <div class="field__row">
          <span class="field__value field__value--mono" data-testid="profile-email">
            {email || 'Not set'}
          </span>
          {#if email}
            {#if emailVerified}
              <span
                class="chip chip--ok"
                data-testid="profile-email-verified"
                title="Email verified"
              >
                <BadgeCheck size={14} aria-hidden="true" />
                <span>Verified</span>
              </span>
            {:else}
              <span
                class="chip chip--warn"
                data-testid="profile-email-unverified"
                title="Email not yet verified"
              >
                <ShieldAlert size={14} aria-hidden="true" />
                <span>Unverified</span>
              </span>
            {/if}
          {/if}
        </div>
      </div>

      <!-- Connected providers, mapped to friendly names. -->
      <div class="field">
        <span class="hf-label">Sign-in methods</span>
        <ul class="provider-list" data-testid="profile-providers">
          {#if providerIds.length === 0}
            <li class="provider-list__empty">No sign-in methods on file.</li>
          {:else}
            {#each providerIds as providerId (providerId)}
              <li class="chip chip--neutral" data-testid="profile-provider">
                {friendlyProviderName(providerId)}
              </li>
            {/each}
          {/if}
        </ul>
      </div>
    </div>
  </div>
</section>

<style>
  /* ----------------------------------------------------------------------- */
  /* Card chrome — matches AuthForm conventions (zinc-950 surround, deeper   */
  /* `#0e1612` card surface, subtle inner-line highlight). Body content sits */
  /* on the same surface so the avatar reads as a single composition.        */
  /* ----------------------------------------------------------------------- */
  .profile-card {
    border-radius: 0.875rem;
    border: 1px solid #27272a; /* zinc-800 */
    background-color: #0e1612;
    padding: 1.25rem;
    color: #fafafa; /* zinc-50 */
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .profile-card__header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .profile-card__title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    letter-spacing: 0.005em;
    color: #fafafa;
  }

  .profile-card__subtitle {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.45;
    color: #71717a; /* zinc-500 */
  }

  .profile-card__body {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 1rem;
    align-items: flex-start;
  }

  @media (max-width: 480px) {
    .profile-card__body {
      grid-template-columns: 1fr;
    }
  }

  /* ----------------------------------------------------------------------- */
  /* Avatar — img when `photoURL` is set, initials fallback otherwise.       */
  /* The initials surface is zinc-800 with the agreed accent-green initial   */
  /* on top so it stays in HuntFlow's visual system.                          */
  /* ----------------------------------------------------------------------- */
  .avatar {
    width: 56px;
    height: 56px;
    border-radius: 9999px;
    overflow: hidden;
    background-color: #27272a; /* zinc-800 */
    border: 1px solid #3f3f46; /* zinc-700 */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }

  .avatar__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .avatar__initial {
    font-size: 1.25rem;
    font-weight: 600;
    color: #60ff5c;
    line-height: 1;
    user-select: none;
  }

  /* ----------------------------------------------------------------------- */
  /* Field rows — each labelled chunk (display name / email / providers).   */
  /* ----------------------------------------------------------------------- */
  .profile-card__fields {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    min-width: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
  }

  .field__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .field__value {
    font-size: 0.875rem;
    color: #fafafa;
    word-break: break-word;
    min-width: 0;
  }

  .field__value--mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
    font-size: 0.8125rem;
    color: #e4e4e7; /* zinc-200 */
  }

  .field__edit {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .field__edit-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .field__error {
    margin: 0.25rem 0 0;
    font-size: 0.8125rem;
    color: #fecaca; /* rose-200 */
  }

  /* ----------------------------------------------------------------------- */
  /* Inline buttons.                                                          */
  /* ----------------------------------------------------------------------- */
  .icon-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-height: 32px;
    padding: 0.25rem 0.625rem;
    border-radius: 0.5rem;
    border: 1px solid #27272a;
    background-color: transparent;
    color: #d4d4d8; /* zinc-300 */
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 150ms ease, background-color 150ms ease,
      color 150ms ease, transform 150ms ease;
  }

  .icon-btn:hover:not(:disabled) {
    border-color: #3f3f46;
    background-color: #131c17;
    color: #fafafa;
  }

  .icon-btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .icon-btn:focus-visible {
    outline: none;
    border-color: #60ff5c;
    box-shadow: 0 0 0 2px rgba(96, 255, 92, 0.35);
  }

  .icon-btn:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .primary-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    min-height: 36px;
    padding: 0.375rem 0.875rem;
    border-radius: 0.5rem;
    border: 1px solid transparent;
    background-color: #60ff5c;
    color: #070d0a;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06),
      0 6px 18px rgba(96, 255, 92, 0.18);
    transition: background-color 150ms ease, transform 150ms ease,
      box-shadow 150ms ease;
  }

  .primary-btn:hover:not(:disabled) {
    background-color: #7dff7a;
  }

  .primary-btn:active:not(:disabled) {
    transform: scale(0.985);
  }

  .primary-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(96, 255, 92, 0.55),
      0 6px 18px rgba(96, 255, 92, 0.25);
  }

  .primary-btn:disabled {
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
    padding: 0.375rem 0.875rem;
    border-radius: 0.5rem;
    border: 1px solid #27272a;
    background-color: #0e1612;
    color: #d4d4d8;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 150ms ease, background-color 150ms ease,
      transform 150ms ease;
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

  /* ----------------------------------------------------------------------- */
  /* Chips — verified / unverified / neutral provider pills.                 */
  /* Contrast targets: green-200 on green-500@12% over zinc-950 surface ≈    */
  /* 8:1; amber-200 on amber-400@12% over zinc-950 surface ≈ 9:1; both clear */
  /* WCAG AA at the small-text threshold.                                    */
  /* ----------------------------------------------------------------------- */
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3125rem;
    padding: 0.1875rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
  }

  .chip--ok {
    background-color: rgba(34, 197, 94, 0.12); /* green-500 @ 12% */
    border: 1px solid rgba(74, 222, 128, 0.35); /* green-400 @ 35% */
    color: #bbf7d0; /* green-200 */
  }

  .chip--warn {
    background-color: rgba(251, 191, 36, 0.14); /* amber-400 @ 14% */
    border: 1px solid rgba(251, 191, 36, 0.45);
    color: #fde68a; /* amber-200 */
  }

  .chip--neutral {
    background-color: rgba(63, 63, 70, 0.45); /* zinc-700 @ 45% */
    border: 1px solid #3f3f46;
    color: #e4e4e7;
  }

  /* ----------------------------------------------------------------------- */
  /* Provider list — flex row of chips.                                      */
  /* ----------------------------------------------------------------------- */
  .provider-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .provider-list__empty {
    font-size: 0.8125rem;
    color: #71717a;
  }
</style>
