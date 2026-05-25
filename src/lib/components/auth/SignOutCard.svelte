<script lang="ts">
  /**
   * SignOutCard — non-destructive sign-out action on /account.
   *
   * Sits between the Subscription card and the Delete card so users
   * have a clear, separate path for "leave this device" vs "delete the
   * account". The deletion path lives elsewhere; this one keeps data
   * intact and just clears the local session.
   *
   * The button calls `signOut()` from `firebase.ts`, which:
   *   - stops the realtime sync engine
   *   - resets the Convex auth binding
   *   - signs the user out of Firebase
   *   - resets `authStore` to the canonical signed-out state
   *
   * After the await we `goto('/')` so the layout's marketing-surface
   * predicate flips and the user lands on the public landing instead
   * of staring at a now-guarded /account that immediately re-renders
   * its `guestView`.
   *
   * Brand-clean: no provider name in the visible copy.
   *
   * Feature: firebase-auth-migration
   * Validates: Requirements 5.4
   */

  import { goto } from '$app/navigation';
  import { Loader2, LogOut } from 'lucide-svelte';
  import { signOut } from '$lib/cloud/firebase';

  let busy = false;
  let error = '';

  async function handleSignOut(): Promise<void> {
    if (busy) return;
    busy = true;
    error = '';
    try {
      await signOut();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Sign out failed.';
      busy = false;
      return;
    }
    // Always navigate, even if signOut threw — the store has been
    // reset to signed-out and we want the user off the gated page.
    void goto('/');
  }
</script>

<section
  class="signout-card"
  aria-labelledby="account-signout-heading"
  data-testid="account-signout-card"
>
  <header class="signout-card__header">
    <h2 id="account-signout-heading" class="signout-card__title">Sign out</h2>
    <p class="signout-card__subtitle">
      Sign out on this device. Your data and subscription stay intact and you can sign back in any time.
    </p>
  </header>

  <div class="signout-card__action">
    <button
      type="button"
      class="signout-btn"
      on:click={handleSignOut}
      disabled={busy}
      data-testid="account-signout-button"
    >
      {#if busy}
        <Loader2 size={16} class="animate-spin" aria-hidden="true" />
        <span>Signing out…</span>
      {:else}
        <LogOut size={16} aria-hidden="true" />
        <span>Sign out</span>
      {/if}
    </button>

    {#if error}
      <p
        class="signout-card__error"
        role="alert"
        aria-live="polite"
        data-testid="account-signout-error"
      >
        {error}
      </p>
    {/if}
  </div>
</section>

<style>
  .signout-card {
    border-radius: 0.875rem;
    border: 1px solid #27272a;
    background-color: #0e1612;
    padding: 1.25rem;
    color: #fafafa;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .signout-card__header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .signout-card__title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: #fafafa;
  }

  .signout-card__subtitle {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.45;
    color: #71717a;
  }

  .signout-card__action {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .signout-card__error {
    margin: 0;
    font-size: 0.8125rem;
    color: #fecaca;
  }

  .signout-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 40px;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid #27272a;
    background-color: transparent;
    color: #d4d4d8;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 150ms ease, background-color 150ms ease,
      color 150ms ease, transform 150ms ease;
  }

  .signout-btn:hover:not(:disabled) {
    border-color: #3f3f46;
    background-color: #131c17;
    color: #fafafa;
  }

  .signout-btn:active:not(:disabled) {
    transform: scale(0.985);
  }

  .signout-btn:focus-visible {
    outline: none;
    border-color: #60ff5c;
    box-shadow: 0 0 0 2px rgba(96, 255, 92, 0.35);
  }

  .signout-btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
</style>
