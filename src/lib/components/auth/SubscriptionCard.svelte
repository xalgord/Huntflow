<script lang="ts">
  /**
   * SubscriptionCard — Pro entitlement entry point on the Account
   * surface.
   *
   * Renders one of two states driven by `$authStore.isPro`:
   *
   *   - `isPro === false` → "Upgrade to Pro" CTA. Click invokes the
   *     Convex `dodo.createCheckoutSession` action with same-origin
   *     return / cancel URLs and full-page-redirects the browser to
   *     the Dodo-hosted checkout session.
   *
   *   - `isPro === true` → small "Pro" pill plus a "Manage
   *     subscription" CTA. Click invokes the Convex
   *     `dodo.getCustomerPortalUrl` action and full-page-redirects
   *     the browser to the customer portal.
   *
   * Both flows use `window.location.assign(url)` because Dodo's
   * checkout and customer-portal pages are not embeddable; same-tab
   * navigation is the standard payment-flow pattern (Stripe and Dodo
   * both behave this way). The post-redirect return path lands the
   * user back on `/account`, where the live `entitlements` query
   * picks up the new `isPro` value as soon as the webhook upserts it.
   *
   * Auth state assumptions:
   *   - The card renders only when `$authStore.signedIn === true`; the
   *     parent route is responsible for not mounting it for signed-out
   *     users (the action requires an authenticated identity anyway,
   *     and would throw "Not authenticated").
   *
   * Error handling: Convex `dodo.*` actions throw `ConvexError` on
   * outbound HTTP failures. `AuthErrorMap` is auth-error-focused, so
   * for billing-API failures we surface a generic, brand-clean
   * "Couldn't start checkout. Try again in a minute." string instead
   * of leaking SDK detail. The error region clears on the next click.
   *
   * Visual style: zinc-950 surround, `#0e1612` card, `hsl(var(--primary))`
   * primary action — the same palette as `AuthForm.svelte`. The "Pro"
   * pill uses the same accent green over a low-alpha tint so it reads
   * as a status badge, not a button. Card surface, not a banner.
   *
   * Brand-clean by construction: no third-party brand substrings
   * appear anywhere in the markup or styles. The only product name
   * shown is "HuntFlow Pro".
   *
   * Feature: firebase-auth-migration
   * Validates: Requirements 8.1, 8.3, 8.5
   */

  import { Loader2, Sparkles, Settings2 } from 'lucide-svelte';
  import { anyApi } from 'convex/server';
  import { authStore } from '$lib/cloud/firebase';
  import { getConvexClient } from '$lib/cloud/convex';

  /**
   * Generic, brand-clean failure copy for billing-API errors. Auth
   * errors flow through `AuthErrorMap`; billing errors don't, so we
   * keep the surfaced string short and reassuring.
   */
  const UPGRADE_ERROR_MESSAGE =
    "Couldn't start checkout. Try again in a minute.";
  const MANAGE_ERROR_MESSAGE =
    "Couldn't open the subscription portal. Try again in a minute.";

  /** True while either action round-trip is in flight. Disables the CTA. */
  let busy = false;
  /** Inline error rendered beneath the CTA. Empty string hides it. */
  let error = '';

  $: signedIn = $authStore.signedIn;
  $: isPro = $authStore.isPro;

  /**
   * Build the same-origin return and cancel URLs Dodo redirects back
   * to after a checkout attempt. `/account?upgrade=success` is the
   * happy-path landing that the cutover smoke checklist exercises;
   * `/account?upgrade=cancelled` lets the route show a non-branded
   * "no charge made" hint without re-rendering this card.
   */
  function buildReturnUrls(): { returnUrl: string; cancelUrl: string } {
    const origin = window.location.origin;
    return {
      returnUrl: `${origin}/account?upgrade=success`,
      cancelUrl: `${origin}/account?upgrade=cancelled`
    };
  }

  async function handleUpgrade(): Promise<void> {
    if (busy) return;
    error = '';

    const convex = getConvexClient();
    if (!convex) {
      error = UPGRADE_ERROR_MESSAGE;
      return;
    }

    busy = true;
    try {
      const { returnUrl, cancelUrl } = buildReturnUrls();
      const result = (await convex.action(
        anyApi.dodo.createCheckoutSession,
        { returnUrl, cancelUrl }
      )) as { checkoutUrl?: unknown } | null;

      const checkoutUrl =
        result && typeof result.checkoutUrl === 'string'
          ? result.checkoutUrl
          : '';

      if (!checkoutUrl) {
        error = UPGRADE_ERROR_MESSAGE;
        return;
      }

      // Same-tab navigation: Dodo's hosted checkout isn't embeddable,
      // and same-tab is the conventional payment-flow pattern.
      window.location.assign(checkoutUrl);
    } catch {
      error = UPGRADE_ERROR_MESSAGE;
    } finally {
      busy = false;
    }
  }

  async function handleManage(): Promise<void> {
    if (busy) return;
    error = '';

    const convex = getConvexClient();
    if (!convex) {
      error = MANAGE_ERROR_MESSAGE;
      return;
    }

    busy = true;
    try {
      const result = (await convex.action(
        anyApi.dodo.getCustomerPortalUrl,
        {}
      )) as { url?: unknown } | null;

      const portalUrl =
        result && typeof result.url === 'string' ? result.url : '';

      if (!portalUrl) {
        error = MANAGE_ERROR_MESSAGE;
        return;
      }

      window.location.assign(portalUrl);
    } catch {
      error = MANAGE_ERROR_MESSAGE;
    } finally {
      busy = false;
    }
  }
</script>

<section
  class="sub-card"
  aria-labelledby="account-subscription-heading"
  data-testid="subscription-card"
>
  <header class="sub-card__header">
    <div class="sub-card__title-row">
      <h2 id="account-subscription-heading" class="sub-card__title">
        Subscription
      </h2>
      {#if isPro}
        <span class="pro-pill" data-testid="subscription-pro-pill">
          <Sparkles size={12} aria-hidden="true" />
          <span>Pro</span>
        </span>
      {/if}
    </div>
    <p class="sub-card__subtitle">
      {#if isPro}
        You're on HuntFlow Pro. Cloud sync and evidence storage are unlocked.
      {:else}
        Upgrade to HuntFlow Pro to unlock cloud sync, evidence storage, and cross-device hunting.
      {/if}
    </p>
  </header>

  <div class="sub-card__actions">
    {#if isPro}
      <button
        type="button"
        class="primary-btn"
        on:click={handleManage}
        disabled={!signedIn || busy}
        data-testid="subscription-manage-button"
      >
        {#if busy}
          <Loader2 size={16} class="animate-spin" aria-hidden="true" />
          <span>Opening portal…</span>
        {:else}
          <Settings2 size={16} aria-hidden="true" />
          <span>Manage subscription</span>
        {/if}
      </button>
    {:else}
      <button
        type="button"
        class="primary-btn"
        on:click={handleUpgrade}
        disabled={!signedIn || busy}
        data-testid="subscription-upgrade-button"
      >
        {#if busy}
          <Loader2 size={16} class="animate-spin" aria-hidden="true" />
          <span>Starting checkout…</span>
        {:else}
          <Sparkles size={16} aria-hidden="true" />
          <span>Upgrade to Pro</span>
        {/if}
      </button>
    {/if}
  </div>

  {#if error}
    <p
      class="sub-card__error"
      role="alert"
      aria-live="polite"
      data-testid="subscription-error"
    >
      {error}
    </p>
  {/if}
</section>

<style>
  /* ----------------------------------------------------------------------- */
  /* Card chrome — matches AuthForm conventions: zinc-950 surround on a      */
  /* `#0e1612` card surface, with the same inner-line highlight that the    */
  /* profile and delete cards use. Renders as a card, not a banner, so it   */
  /* slots into the Account page beside `AccountProfileCard`.                */
  /* ----------------------------------------------------------------------- */
  .sub-card {
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

  .sub-card__header {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .sub-card__title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .sub-card__title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    letter-spacing: 0.005em;
    color: #fafafa;
  }

  .sub-card__subtitle {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.5;
    color: #a1a1aa; /* zinc-400 — clears WCAG AA on `#0e1612` at ~7:1. */
  }

  /* ----------------------------------------------------------------------- */
  /* Pro pill — small status badge that uses the agreed accent green over   */
  /* a low-alpha tint. Reads as a badge rather than an action because it    */
  /* has no border-radius mismatch with the title baseline and no hover     */
  /* state. Contrast of `#fda4af` (green-300) on the tinted surface clears */
  /* WCAG AA for small text.                                                 */
  /* ----------------------------------------------------------------------- */
  .pro-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    background-color: rgba(225, 29, 52, 0.14);
    border: 1px solid rgba(225, 29, 52, 0.4);
    color: #fda4af; /* green-300 */
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    line-height: 1.2;
    white-space: nowrap;
  }

  /* ----------------------------------------------------------------------- */
  /* Actions row — single CTA, hugs the start of the card. On narrow        */
  /* viewports the button stretches to the full width so it's easy to tap.  */
  /* ----------------------------------------------------------------------- */
  .sub-card__actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .sub-card__error {
    margin: 0;
    font-size: 0.8125rem;
    color: #fecaca; /* rose-200 */
  }

  /* ----------------------------------------------------------------------- */
  /* Primary CTA — same accent green as `AuthForm.primary-btn`. Contrast    */
  /* of `#070d0a` (zinc-950) text on `hsl(var(--primary))` (accent) is ~13:1, well past */
  /* WCAG AAA for normal-size text.                                         */
  /* ----------------------------------------------------------------------- */
  .primary-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 40px;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid transparent;
    background-color: hsl(var(--primary));
    color: #ffffff;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06),
      0 6px 18px rgba(225, 29, 52, 0.18);
    transition: background-color 150ms ease, transform 150ms ease,
      box-shadow 150ms ease;
  }

  .primary-btn:hover:not(:disabled) {
    background-color: #c81530;
  }

  .primary-btn:active:not(:disabled) {
    transform: scale(0.985);
  }

  .primary-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(225, 29, 52, 0.55),
      0 6px 18px rgba(225, 29, 52, 0.25);
  }

  .primary-btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
    box-shadow: none;
  }

  @media (max-width: 480px) {
    .primary-btn {
      width: 100%;
    }
  }
</style>
