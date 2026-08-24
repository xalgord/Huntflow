<script lang="ts">
  /**
   * `/pricing` — public marketing surface for the single "HuntFlow Pro" tier.
   *
   * After the Firebase Auth + Dodo Payments migration, this page no longer
   * mounts a third-party `<PricingTable />` widget. The plan presentation is
   * a custom `<PlanCard>` and the upgrade/manage entry point is the
   * brand-clean `<SubscriptionCard>` (which calls Convex `dodo.*` actions and
   * full-page-redirects to a Dodo-hosted checkout / customer portal).
   *
   * Three rendering modes, mutually exclusive, keyed off the auth store:
   *
   *   - localView  (`!$authStore.configured`)
   *       Self-hosted install with no Firebase config. There's no billing
   *       in this mode; we silently bounce to `/account` so the user lands
   *       on the local-workspace summary instead of a cloud-only pitch.
   *
   *   - signedInView (`$authStore.signedIn === true`)
   *       Renders `<PlanCard>` with `<SubscriptionCard>` slotted as the CTA.
   *       SubscriptionCard reads `$authStore.isPro` and either:
   *         - shows "Upgrade to Pro" → calls `dodo.createCheckoutSession`,
   *         - or shows "Manage subscription" → calls `dodo.getCustomerPortalUrl`.
   *
   *   - guestView (configured but signed out)
   *       Renders `<PlanCard>` with a "Sign in to upgrade" link slotted as
   *       the CTA. The link routes to `/sign-in?redirect=/pricing` so the
   *       user lands back here after authenticating, where SubscriptionCard
   *       takes over the upgrade flow.
   *
   * Brand-clean by construction: zero third-party widgets, zero remote
   * scripts, zero third-party trust or attribution badges. The only
   * product name shown is HuntFlow Pro.
   *
   * Feature: firebase-auth-migration
   * Validates: Requirements 7.7, 8.1, 8.5, 10.3
   */

  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/cloud/firebase';
  import PlanCard from '$lib/components/auth/PlanCard.svelte';
  import SubscriptionCard from '$lib/components/auth/SubscriptionCard.svelte';
  import {
    ArrowRight,
    Cloud,
    Crosshair,
    Github,
    LogIn,
    Lock,
    Smartphone,
    Sparkles
  } from 'lucide-svelte';
  import InstallCommand from '$lib/components/landing/InstallCommand.svelte';
  import { onMount } from 'svelte';

  // Set true when bouncing to /account in local-mode so the marketing
  // chrome doesn't flash before the redirect lands.
  let redirectingLocal = false;

  // The `HuntFlow Pro` feature list rendered inside `<PlanCard>`. Kept
  // in sync with the value props on the landing page; brand-clean by
  // construction (no provider names, no third-party copy).
  const proFeatures: string[] = [
    'Real-time cloud sync across every device (web, desktop, mobile PWA)',
    'End-to-end encrypted evidence and notes',
    'Conflict-free collaborative editing on the same workspace',
    'Encrypted automatic backups',
    'Priority email support',
    'Early access to upcoming features (report builder, team workspace)'
  ];

  function normalizePathname(pathname: string): string {
    if (pathname === '/') return pathname;
    return pathname.replace(/\/+$/, '') || '/';
  }

  onMount(async () => {
    if (!browser) return;

    // Local-mode short-circuit. There's no billing in a self-hosted
    // build — bounce to /account, which renders a local-workspace
    // view (with a "get cloud sync at huntflow.xalgorix.com" CTA) in
    // that mode.
    if (!$authStore.configured) {
      redirectingLocal = true;
      try {
        await goto('/account', { replaceState: true });
      } catch {
        /* fall through */
      }
      if (browser && normalizePathname(window.location.pathname) === '/pricing') {
        window.location.replace('/account');
      }
    }
  });
</script>

<svelte:head>
  <title>Pricing &middot; HuntFlow</title>
  <meta
    name="description"
    content="HuntFlow is free forever for the core. Upgrade to Pro for real-time cloud sync, end-to-end encrypted evidence, and priority support."
  />
  <link rel="canonical" href="https://huntflow.xalgorix.com/pricing" />
</svelte:head>

{#if redirectingLocal || !$authStore.configured}
  <!--
    Local-mode placeholder. Pricing has no meaning when running
    self-hosted (no billing, no subscription concept), so we silently
    bounce to /account. Showing this minimal frame instead of the
    full marketing pricing chrome avoids a flash of the cloud pitch
    on private offline installs.
  -->
  <main
    class="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 px-4 text-center text-zinc-300"
    aria-busy="true"
    aria-live="polite"
  >
    <span
      class="flex h-12 w-12 items-center justify-center rounded-xl border border-primary-500/30 bg-primary-500/10 text-primary-400"
    >
      <Crosshair size={22} aria-hidden="true" />
    </span>
    <p class="text-sm font-medium text-zinc-200">Opening your local workspace&hellip;</p>
  </main>
{:else}
<div class="pricing-page min-h-screen overflow-hidden text-zinc-100">
  <header class="pricing-header sticky top-0 z-50 border-b border-white/[0.06] bg-[hsl(350_18%_3%/0.8)] backdrop-blur-xl backdrop-saturate-150">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
      <a href="/" class="flex min-h-[44px] items-center gap-2.5 text-zinc-100 transition-opacity hover:opacity-80">
        <img
          src="/icons/huntflow-logo.png"
          alt="HuntFlow"
          width="36"
          height="36"
          class="h-9 w-9 rounded-lg"
          loading="eager"
          decoding="async"
        />
        <span class="text-base font-semibold tracking-tight">HuntFlow</span>
      </a>

      <nav class="hidden items-center gap-7 text-sm text-zinc-400 md:flex" aria-label="Pricing nav">
        <a class="transition hover:text-zinc-100" href="/#features">Features</a>
        <a class="transition hover:text-zinc-100" href="/#cloud-sync">Cloud Sync</a>
        <a class="transition hover:text-zinc-100" href="/#faq">FAQ</a>
      </nav>

      <div class="flex items-center gap-2">
        {#if $authStore.signedIn}
          <a
            href="/account"
            class="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-[10px] bg-primary-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_12px_rgba(225,29,52,0.15)] transition hover:bg-primary-500 hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_20px_rgba(225,29,52,0.25)]"
          >
            Open app
            <ArrowRight size={14} aria-hidden="true" />
          </a>
        {:else}
          <a
            href="/sign-in"
            class="hidden min-h-[36px] items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:text-zinc-100 sm:inline-flex"
          >
            Sign in
          </a>
          <a
            href="/sign-up"
            class="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-[10px] bg-primary-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_12px_rgba(225,29,52,0.15)] transition hover:bg-primary-500 hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_20px_rgba(225,29,52,0.25)]"
          >
            Get started
          </a>
        {/if}
      </div>
    </div>
  </header>

  <section class="pricing-hero relative isolate border-b border-white/[0.06] px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
    <div class="absolute inset-0 -z-10" aria-hidden="true">
      <div class="absolute inset-0 bg-zinc-950"></div>
      <div class="absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(ellipse_at_top,_rgba(225,29,52,0.18),_transparent_55%)]"></div>
      <div class="absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_80%_20%,_rgba(225,29,52,0.08),_transparent_40%)]"></div>
      <div class="absolute inset-x-0 bottom-0 h-[320px] bg-[radial-gradient(ellipse_at_bottom,_rgba(225,29,52,0.06),_transparent_60%)]"></div>
    </div>
    <!-- Grid overlay matching landing page -->
    <div class="absolute inset-0 -z-10 opacity-[0.18]" aria-hidden="true" style="background-image:linear-gradient(to right,rgb(30 41 59/0.5) 1px,transparent 1px),linear-gradient(to bottom,rgb(30 41 59/0.5) 1px,transparent 1px);background-size:56px 56px;mask-image:radial-gradient(ellipse at center top,black 0%,transparent 70%)"></div>

    <div class="mx-auto max-w-3xl text-center">
      <span class="pricing-badge inline-flex items-center gap-2 rounded-full border border-primary-500/25 bg-primary-500/[0.08] px-4 py-1.5 text-xs font-medium text-primary-300 shadow-[0_0_16px_rgba(225,29,52,0.08)] backdrop-blur-sm">
        <Sparkles size={13} aria-hidden="true" class="animate-pulse" />
        Simple, hunter-friendly pricing
      </span>
      <h1 class="mt-8 text-balance text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
        Free forever. Pro when you need
        <span class="bg-gradient-to-br from-primary-200 via-primary-400 to-primary-600 bg-clip-text text-transparent">
          real-time sync.
        </span>
      </h1>
      <p class="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-zinc-300 sm:text-lg">
        Every feature except cloud sync is free, forever, with no account required. Upgrade only when you want
        seamless real-time updates across every device you hunt from.
      </p>
    </div>
  </section>

  <!--
    Plan presentation. Single tier ("HuntFlow Pro") rendered through the
    brand-clean `<PlanCard>`. The CTA slot is filled by:
      - `<SubscriptionCard>` for signed-in users (handles both Upgrade
        and Manage states based on `$authStore.isPro` internally), or
      - a "Sign in to upgrade" link for signed-out users (the
        Convex `dodo.*` actions require an authenticated identity, so
        we route through the sign-in form first instead of letting the
        click fail). The `redirect=/pricing` query param brings the
        user back here once authenticated.
  -->
  <section class="relative border-b border-white/[0.06] px-4 py-16 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-6xl">
      <div class="mx-auto max-w-md">
        <PlanCard
          name="HuntFlow Pro"
          tagline="Real-time cloud sync, encrypted evidence, and cross-device hunting."
          price="$6 / month"
          features={proFeatures}
        >
          <svelte:fragment slot="cta">
            {#if $authStore.signedIn}
              <SubscriptionCard />
            {:else}
              <a
                href="/sign-in?redirect=/pricing"
                class="signin-cta"
                data-testid="pricing-signin-cta"
              >
                <LogIn size={16} aria-hidden="true" />
                <span>Sign in to upgrade</span>
              </a>
              <p class="signin-cta__hint">
                Don&apos;t have an account?
                <a href="/sign-up?redirect=/pricing" class="signin-cta__link">Create one</a>.
              </p>
            {/if}
          </svelte:fragment>
        </PlanCard>
      </div>
    </div>
  </section>

  <!-- Pro value reminder, three concrete callouts -->
  <section class="relative border-b border-white/[0.06] px-4 py-20 sm:px-6 lg:px-8">
    <div class="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom,_rgba(225,29,52,0.04),_transparent_60%)]" aria-hidden="true"></div>
    <div class="mx-auto max-w-6xl">
      <p class="hf-eyebrow">What Pro buys you</p>
      <h2 class="mt-2 text-3xl font-bold leading-tight text-white sm:text-4xl">Three things, no fluff.</h2>

      <div class="mt-10 grid gap-5 md:grid-cols-3">
        <article class="value-card group relative overflow-hidden rounded-2xl border border-white/[0.08] p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary-500/30 hover:-tranzinc-y-0.5">
          <div class="absolute inset-0 -z-10 bg-gradient-to-br from-primary-500/[0.04] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
          <div class="flex h-11 w-11 items-center justify-center rounded-xl border border-primary-500/20 bg-primary-500/10 text-primary-400 shadow-[0_0_12px_rgba(225,29,52,0.08)] transition-shadow group-hover:shadow-[0_0_20px_rgba(225,29,52,0.15)]">
            <Cloud size={20} aria-hidden="true" />
          </div>
          <h3 class="mt-5 text-lg font-semibold text-white">Real-time sync</h3>
          <p class="mt-2.5 text-sm leading-6 text-zinc-400">
            Every edit is reflected on every signed-in device in under a second. Same data on laptop, phone, tablet.
          </p>
        </article>
        <article class="value-card group relative overflow-hidden rounded-2xl border border-white/[0.08] p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary-500/30 hover:-tranzinc-y-0.5">
          <div class="absolute inset-0 -z-10 bg-gradient-to-br from-primary-500/[0.04] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
          <div class="flex h-11 w-11 items-center justify-center rounded-xl border border-primary-500/20 bg-primary-500/10 text-primary-400 shadow-[0_0_12px_rgba(225,29,52,0.08)] transition-shadow group-hover:shadow-[0_0_20px_rgba(225,29,52,0.15)]">
            <Lock size={20} aria-hidden="true" />
          </div>
          <h3 class="mt-5 text-lg font-semibold text-white">Encrypted at rest</h3>
          <p class="mt-2.5 text-sm leading-6 text-zinc-400">
            Notes, evidence and report drafts are encrypted client-side. Even we can&apos;t read your findings.
          </p>
        </article>
        <article class="value-card group relative overflow-hidden rounded-2xl border border-white/[0.08] p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary-500/30 hover:-tranzinc-y-0.5">
          <div class="absolute inset-0 -z-10 bg-gradient-to-br from-primary-500/[0.04] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
          <div class="flex h-11 w-11 items-center justify-center rounded-xl border border-primary-500/20 bg-primary-500/10 text-primary-400 shadow-[0_0_12px_rgba(225,29,52,0.08)] transition-shadow group-hover:shadow-[0_0_20px_rgba(225,29,52,0.15)]">
            <Smartphone size={20} aria-hidden="true" />
          </div>
          <h3 class="mt-5 text-lg font-semibold text-white">Mobile-friendly</h3>
          <p class="mt-2.5 text-sm leading-6 text-zinc-400">
            Capture a finding on your phone the moment you spot it. It is on your laptop before you sit down.
          </p>
        </article>
      </div>
    </div>
  </section>

  <!-- Closing CTA -->
  <section class="relative border-b border-white/[0.06] px-4 py-20 sm:px-6 lg:px-8">
    <div class="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_rgba(225,29,52,0.08),_transparent_60%)]" aria-hidden="true"></div>
    <div class="mx-auto max-w-3xl text-center">
      <h2 class="text-3xl font-bold leading-tight text-white sm:text-4xl">Stop juggling tabs. Start a hunt.</h2>
      <p class="mt-3 text-base leading-7 text-zinc-400">
        Install in one command. No login required to start.
      </p>
      <div class="mx-auto mt-6 max-w-xl">
        <InstallCommand />
      </div>
      <div class="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <a
          href="/account"
          class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] bg-primary-600 px-6 py-3 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_12px_rgba(225,29,52,0.15)] transition hover:bg-primary-500 hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_20px_rgba(225,29,52,0.25)]"
        >
          Open the app
        </a>
        <a
          href="/sign-up"
          class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-6 py-3 text-sm font-medium text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:bg-white/[0.08] hover:border-white/[0.14]"
        >
          Create an account
        </a>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="relative px-4 py-12 sm:px-6 lg:px-8">
    <div class="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
      <div class="max-w-md">
        <div class="flex items-center gap-2.5 text-zinc-100">
          <img
            src="/icons/huntflow-logo.png"
            alt="HuntFlow"
            width="36"
            height="36"
            class="h-9 w-9 rounded-lg"
            loading="lazy"
            decoding="async"
          />
          <span class="font-semibold">HuntFlow</span>
        </div>
        <p class="mt-3 text-sm leading-6 text-zinc-500">
          The bug bounty workflow OS. Built by hunters, for hunters. Open core, offline-first.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-x-12 gap-y-3 text-sm sm:grid-cols-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Product</p>
          <a class="mt-3 block text-zinc-300 hover:text-zinc-100" href="/#features">Features</a>
          <a class="mt-2 block text-zinc-300 hover:text-zinc-100" href="/pricing">Pricing</a>
          <a class="mt-2 block text-zinc-300 hover:text-zinc-100" href="/#cloud-sync">Cloud sync</a>
          <a class="mt-2 block text-zinc-300 hover:text-zinc-100" href="/account">Open app</a>
        </div>
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Account</p>
          <a class="mt-3 block text-zinc-300 hover:text-zinc-100" href="/sign-in">Sign in</a>
          <a class="mt-2 block text-zinc-300 hover:text-zinc-100" href="/sign-up">Sign up</a>
          <a class="mt-2 block text-zinc-300 hover:text-zinc-100" href="/#faq">FAQ</a>
        </div>
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Connect</p>
          <a
            class="mt-3 inline-flex items-center gap-2 text-zinc-300 hover:text-zinc-100"
            href="https://github.com/xalgord/huntflow"
            rel="noreferrer"
          >
            <Github size={14} aria-hidden="true" />
            GitHub
          </a>
        </div>
      </div>
    </div>

    <div class="mx-auto mt-10 max-w-6xl border-t border-white/[0.06] pt-6 text-xs text-zinc-600">
      &copy; 2026 HuntFlow. MIT Licensed.
    </div>
  </footer>
</div>
{/if}

<style>
  /* ----------------------------------------------------------------------- */
  /* Page chrome — subtle vertical gradient under the hero so the radial    */
  /* glows in the markup get something to sit on top of.                    */
  /* ----------------------------------------------------------------------- */
  .pricing-page {
    background:
      linear-gradient(180deg, hsl(350 18% 3%) 0%, hsl(350 20% 2%) 100%);
  }

  /* ----------------------------------------------------------------------- */
  /* Sign-in CTA inside the PlanCard slot — visual parity with             */
  /* `SubscriptionCard.primary-btn` so signed-in and signed-out users see   */
  /* the same button shape and color in the same slot. Contrast of         */
  /* `#070d0a` text on `hsl(var(--primary))` is ~13:1, well past WCAG AAA.             */
  /* ----------------------------------------------------------------------- */
  .signin-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    min-height: 44px;
    padding: 0.6rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid transparent;
    background-color: hsl(var(--primary));
    color: #ffffff;
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: none;
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.06),
      0 6px 18px rgba(225, 29, 52, 0.18);
    transition: background-color 150ms ease, transform 150ms ease,
      box-shadow 150ms ease;
  }

  .signin-cta:hover {
    background-color: #c81530;
  }

  .signin-cta:active {
    transform: scale(0.985);
  }

  .signin-cta:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 2px rgba(225, 29, 52, 0.55),
      0 6px 18px rgba(225, 29, 52, 0.25);
  }

  .signin-cta__hint {
    margin: 0;
    font-size: 0.8125rem;
    color: #a1a1aa; /* zinc-400 — clears WCAG AA on `#0e1612` at ~7:1 */
    text-align: center;
  }

  .signin-cta__link {
    color: #fda4af; /* crimson-300 */
    text-decoration: none;
    border-bottom: 1px solid rgba(253, 164, 175, 0.4);
  }

  .signin-cta__link:hover {
    color: #fecdd3;
    border-bottom-color: rgba(254, 205, 211, 0.6);
  }

  /* ----------------------------------------------------------------------- */
  /* Hero / badge entrance animations — kept from the pre-migration page    */
  /* so the marketing chrome still has the same polish.                    */
  /* ----------------------------------------------------------------------- */
  .pricing-hero {
    animation: hero-fade-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .pricing-badge {
    animation: badge-slide-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both;
  }

  /* ----------------------------------------------------------------------- */
  /* Value cards — three callout cards under the plan card. Each gets a    */
  /* small staggered slide-up to draw the eye downward through the page.   */
  /* ----------------------------------------------------------------------- */
  .value-card {
    background:
      linear-gradient(180deg, hsl(var(--primary) / 0.025), transparent 40%),
      hsl(350 14% 7% / 0.6);
    box-shadow:
      inset 0 1px 0 hsl(0 0% 100% / 0.04),
      0 16px 48px -12px rgba(0, 0, 0, 0.35);
  }

  .value-card:nth-child(1) {
    animation: card-slide-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both;
  }
  .value-card:nth-child(2) {
    animation: card-slide-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.2s both;
  }
  .value-card:nth-child(3) {
    animation: card-slide-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both;
  }

  @keyframes hero-fade-in {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes badge-slide-in {
    from {
      opacity: 0;
      transform: translateY(-8px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes card-slide-up {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
