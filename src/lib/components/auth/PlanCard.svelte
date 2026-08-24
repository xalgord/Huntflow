<script lang="ts">
  /**
   * PlanCard — static, single-tier plan card for the "HuntFlow Pro"
   * subscription.
   *
   * Renders plain DOM only:
   *   - Plan name (default "HuntFlow Pro")
   *   - Short tagline
   *   - Price (placeholder by default, e.g. "$X / month")
   *   - Feature list with accent-green checkmarks
   *   - A `<slot name="cta" />` that the route fills with the Upgrade
   *     button (typically by composing this card with `SubscriptionCard`)
   *
   * The component is intentionally provider-agnostic and embeds zero
   * third-party widgets, scripts, or remote iframes — every visible
   * element is rendered locally so the HuntFlow brand is the only one
   * on the surface. Used on `/pricing` and any future plan-comparison
   * surfaces.
   *
   * Visual style follows the agreed AuthUI palette: zinc-950 surround,
   * `#0e1612` card, `hsl(var(--primary))` accent for the price and the feature
   * checkmarks, with a subtle green glow that signals "premium" without
   * overwhelming the dark theme.
   *
   * Feature: firebase-auth-migration
   * Validates: Requirements 7.7, 8.5, 10.1, 10.2
   */

  import { Check, Sparkles } from 'lucide-svelte';

  /** Plan display name. Defaults to the single paid tier. */
  export let name: string = 'HuntFlow Pro';

  /** Short tagline rendered under the plan name. Plain text. */
  export let tagline: string =
    'Real-time cloud sync, encrypted evidence, and cross-device hunting.';

  /**
   * Price string. Kept as a placeholder by default so the route can
   * substitute the live value (e.g. "$6 / month") without forcing this
   * component to know about billing configuration.
   */
  export let price: string = '$X / month';

  /**
   * Feature list. Each entry is rendered as a row with an accent-green
   * checkmark. Defaults are derived from the established landing /
   * pricing copy (cloud sync, evidence storage, cross-device hunting,
   * priority support) and stay deliberately brand-clean.
   */
  export let features: string[] = [
    'Real-time cloud sync across every device',
    'End-to-end encrypted evidence storage',
    'Cross-device hunting (web, desktop, mobile PWA)',
    'Encrypted automatic backups',
    'Priority email support'
  ];
</script>

<article
  class="plan-card"
  aria-labelledby="plan-card-heading"
  data-testid="plan-card"
>
  <span class="plan-card__badge" aria-hidden="true">
    <Sparkles size={12} />
    <span>Recommended</span>
  </span>

  <header class="plan-card__header">
    <p class="plan-card__eyebrow">For serious hunters</p>
    <h2 id="plan-card-heading" class="plan-card__title">{name}</h2>
    <p class="plan-card__tagline">{tagline}</p>
  </header>

  <div class="plan-card__price-row">
    <span class="plan-card__price" data-testid="plan-card-price">{price}</span>
  </div>

  <ul class="plan-card__features" data-testid="plan-card-features">
    {#each features as feature}
      <li class="plan-card__feature">
        <span class="plan-card__check" aria-hidden="true">
          <Check size={14} />
        </span>
        <span>{feature}</span>
      </li>
    {/each}
  </ul>

  {#if $$slots.cta}
    <div class="plan-card__cta" data-testid="plan-card-cta">
      <slot name="cta" />
    </div>
  {/if}
</article>

<style>
  /* -----------------------------------------------------------------------
   * Card chrome — zinc-950 surround on a `#0e1612` surface, with a thin
   * accent border and a subtle green outer glow. The glow is intentionally
   * soft (low alpha, large radius) so the card reads as "premium" without
   * competing with adjacent UI.
   * --------------------------------------------------------------------- */
  .plan-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.75rem;
    border-radius: 1rem;
    border: 1px solid rgba(225, 29, 52, 0.28);
    background: linear-gradient(
      168deg,
      rgba(14, 22, 18, 0.95),
      rgba(7, 13, 10, 0.98)
    );
    color: #fafafa; /* zinc-50 */
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.04),
      0 1px 2px rgba(0, 0, 0, 0.3),
      0 0 32px rgba(225, 29, 52, 0.08);
    transition: border-color 200ms ease, box-shadow 200ms ease;
  }

  .plan-card:hover {
    border-color: rgba(225, 29, 52, 0.45);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.04),
      0 1px 2px rgba(0, 0, 0, 0.3),
      0 0 48px rgba(225, 29, 52, 0.18);
  }

  /* -----------------------------------------------------------------------
   * Recommended badge — small pill anchored to the top edge. Uses the
   * accent green at full saturation against `#070d0a` text for ~13:1
   * contrast (WCAG AAA).
   * --------------------------------------------------------------------- */
  .plan-card__badge {
    position: absolute;
    top: -0.75rem;
    right: 1.5rem;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    background-color: hsl(var(--primary));
    color: #ffffff; /* zinc-950 */
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    line-height: 1.2;
    box-shadow: 0 0 12px rgba(225, 29, 52, 0.35);
  }

  /* -----------------------------------------------------------------------
   * Header — eyebrow, title, tagline. Eyebrow uses an accent-tinted
   * green-300 for a status feel; title uses zinc-50 for max contrast.
   * --------------------------------------------------------------------- */
  .plan-card__header {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .plan-card__eyebrow {
    margin: 0;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(253, 164, 175, 0.85); /* green-300, 85% — clears AA on `#0e1612` */
  }

  .plan-card__title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.005em;
    color: #ffffff;
  }

  .plan-card__tagline {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5;
    color: #a1a1aa; /* zinc-400 — clears WCAG AA at ~7:1 */
  }

  /* -----------------------------------------------------------------------
   * Price row — single accent-green numeric. The route can pass any
   * pre-formatted string ("$6 / month", "$60 / year", "$X / month").
   * --------------------------------------------------------------------- */
  .plan-card__price-row {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .plan-card__price {
    font-size: 2.25rem;
    font-weight: 700;
    line-height: 1;
    color: hsl(var(--primary));
    text-shadow: 0 0 16px rgba(225, 29, 52, 0.25);
  }

  /* -----------------------------------------------------------------------
   * Feature list — accent-green checkmarks in a low-alpha tint, with
   * zinc-200 body copy. The check icon sits in a fixed-size square so the
   * text baseline stays consistent across multi-line items.
   * --------------------------------------------------------------------- */
  .plan-card__features {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .plan-card__feature {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    font-size: 0.875rem;
    line-height: 1.5;
    color: #e4e4e7; /* zinc-200 */
  }

  .plan-card__check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
    margin-top: 0.125rem;
    border-radius: 9999px;
    background-color: rgba(225, 29, 52, 0.14);
    color: #fda4af; /* green-300 — clears AA on the tinted surface */
    border: 1px solid rgba(225, 29, 52, 0.3);
  }

  /* -----------------------------------------------------------------------
   * CTA slot — fills any height the consumer slots in. Centered on the
   * card's start edge; the consumer (typically `SubscriptionCard`)
   * controls the actual button styling.
   * --------------------------------------------------------------------- */
  .plan-card__cta {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  /* Compact layout on narrow viewports — keep the card readable on
     phone widths where the badge would otherwise crowd the title. */
  @media (max-width: 480px) {
    .plan-card {
      padding: 1.5rem;
      gap: 1rem;
    }

    .plan-card__badge {
      right: 1rem;
    }

    .plan-card__price {
      font-size: 2rem;
    }
  }
</style>
