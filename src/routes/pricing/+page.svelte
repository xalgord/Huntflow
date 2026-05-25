<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { clerkAuthStore, initClerk, mountClerkPricingTable, openClerkSubscriptions } from '$lib/cloud/clerk';
  import {
    ArrowRight,
    Check,
    Cloud,
    CreditCard,
    Crosshair,
    Github,
    Lock,
    ShieldCheck,
    Smartphone,
    Sparkles,
    Twitter
  } from 'lucide-svelte';
  import InstallCommand from '$lib/components/landing/InstallCommand.svelte';
  import { onDestroy, onMount } from 'svelte';

  let mountNode: HTMLDivElement | null = null;
  let unmount: (() => void) | null = null;
  let billingMounted = false;
  let billingEnabled = false;
  let billingUnavailable = false;
  let billingObserver: MutationObserver | null = null;
  let billingLoadTimer: ReturnType<typeof setTimeout> | null = null;
  // Set true when we're navigating away in local-mode so the static
  // pricing fallback markup doesn't flash before the bounce lands.
  let redirectingLocal = false;

  // Static feature list used as a fallback when Clerk Billing is not
  // configured yet. Every checkmark below is a Pro entitlement.
  const proFeatures: string[] = [
    'Real-time cloud sync across every device (web, desktop, mobile PWA)',
    'End-to-end encrypted evidence and notes',
    'Conflict-free collaborative editing on the same workspace',
    'Encrypted automatic backups',
    'Priority email support',
    'Early access to upcoming features (report builder, team workspace)'
  ];

  const freeFeatures: string[] = [
    'Unlimited targets, sessions, notes, recon and submissions',
    'Vulnerability templates, evidence canvas, hunter toolkit',
    'Stats, streaks, ROI per program',
    'Full local IndexedDB storage',
    'Encrypted manual backup and restore (.huntflow file)',
    'Works fully offline'
  ];

  let openingSubscriptions = false;

  $: showStaticPlans =
    !($clerkAuthStore.signedIn && $clerkAuthStore.isPro) &&
    !billingMounted;

  function normalizePathname(pathname: string): string {
    if (pathname === '/') return pathname;
    return pathname.replace(/\/+$/, '') || '/';
  }

  function clearBillingWatch(): void {
    billingObserver?.disconnect();
    billingObserver = null;
    if (billingLoadTimer) {
      clearTimeout(billingLoadTimer);
      billingLoadTimer = null;
    }
  }

  function mountHasVisiblePricing(node: HTMLElement | null): boolean {
    if (!browser || !node) return false;

    const likelyPricingElements = node.querySelectorAll<HTMLElement>(
      '.cl-pricingTableCard, [class*="pricingTableCard"], [class*="PricingTableCard"], button, a'
    );

    for (let index = 0; index < likelyPricingElements.length; index += 1) {
      const element = likelyPricingElements[index];
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        rect.width > 0 &&
        rect.height > 0 &&
        element.textContent?.trim()
      ) {
        return true;
      }
    }

    return false;
  }

  function refreshBillingMounted(): void {
    if (!mountHasVisiblePricing(mountNode)) return;
    billingMounted = true;
    billingUnavailable = false;
    if (billingLoadTimer) {
      clearTimeout(billingLoadTimer);
      billingLoadTimer = null;
    }
  }

  function watchBillingMount(): void {
    clearBillingWatch();
    if (!browser || !mountNode) return;

    billingObserver = new MutationObserver(refreshBillingMounted);
    billingObserver.observe(mountNode, {
      attributes: true,
      childList: true,
      subtree: true
    });

    requestAnimationFrame(refreshBillingMounted);
    billingLoadTimer = setTimeout(() => {
      refreshBillingMounted();
      if (!billingMounted) {
        billingUnavailable = true;
      }
    }, 2500);
  }

  function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  async function checkBillingAvailability(): Promise<boolean> {
    type BillingProbeClerk = {
      mountPricingTable?: unknown;
      billing?: {
        getPlans?: (params?: {
          for?: 'user' | 'organization';
          pageSize?: number;
        }) => Promise<unknown>;
      };
    };

    const clerk = (await initClerk()) as BillingProbeClerk | null;
    if (!clerk) return false;

    if (typeof clerk.billing?.getPlans !== 'function') {
      return typeof clerk.mountPricingTable === 'function';
    }

    try {
      await clerk.billing.getPlans({ for: 'user', pageSize: 1 });
      return true;
    } catch (error) {
      console.info(
        '[HuntFlow] Clerk Billing is unavailable; showing static pricing cards.',
        errorMessage(error)
      );
      return false;
    }
  }

  async function handleManageSubscription(): Promise<void> {
    openingSubscriptions = true;
    try {
      const opened = await openClerkSubscriptions();
      if (!opened) {
        // Clerk billing modal not available — the UserProfile widget on
        // /account has a Billing tab that serves as the next-best surface.
        // Use SvelteKit's goto so we don't trigger a full reload that
        // would drop in-memory Clerk state.
        await goto('/account');
      }
    } finally {
      openingSubscriptions = false;
    }
  }

  onMount(async () => {
    if (!browser) return;

    // Local-mode short-circuit. There's no billing in a self-hosted
    // build — bounce to /account, which renders a local-workspace
    // view (with a "get cloud sync at huntflow.xalgorix.com" CTA) in that mode.
    if (!$clerkAuthStore.configured) {
      redirectingLocal = true;
      try {
        await goto('/account', { replaceState: true });
      } catch {
        /* fall through */
      }
      if (browser && normalizePathname(window.location.pathname) === '/pricing') {
        window.location.replace('/account');
      }
      return;
    }

    // Don't mount the pricing widget for Pro subscribers — they only
    // need the "already Pro" management banner, not a second buy surface.
    if (!mountNode || $clerkAuthStore.isPro) return;

    billingEnabled = await checkBillingAvailability();
    if (!billingEnabled) {
      billingUnavailable = true;
      return;
    }

    unmount = await mountClerkPricingTable(mountNode, {
      // After a successful subscription checkout:
      //   · Signed-in flow  → /account?welcome=pro (shows the Pro welcome banner)
      //   · Sign-up flow    → /sign-up?redirect=/account?welcome=pro
      //     (Clerk handles sign-up, then lands on /account with the banner)
      newSubscriptionRedirectUrl: '/account?welcome=pro'
    });
    watchBillingMount();
  });

  onDestroy(() => {
    clearBillingWatch();
    unmount?.();
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

{#if redirectingLocal || !$clerkAuthStore.configured}
  <!-- Local-mode placeholder. Pricing has no meaning when running
       self-hosted (no Clerk Billing, no subscription concept), so we
       silently bounce to /account. Showing this minimal frame instead
       of the full marketing pricing chrome avoids a flash of the
       cloud pitch on private offline installs. -->
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
  <header class="pricing-header sticky top-0 z-50 border-b border-white/[0.06] bg-[hsl(140_18%_3%/0.8)] backdrop-blur-xl backdrop-saturate-150">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
      <a href="/" class="flex min-h-[44px] items-center gap-2.5 text-zinc-100 transition-opacity hover:opacity-80">
        <img
          src="/brand/huntflow-mark.jpg"
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
        {#if $clerkAuthStore.signedIn}
          <a
            href="/account"
            class="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-[10px] bg-primary-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_12px_rgba(96,255,92,0.15)] transition hover:bg-primary-500 hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_20px_rgba(96,255,92,0.25)]"
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
            class="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-[10px] bg-primary-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_12px_rgba(96,255,92,0.15)] transition hover:bg-primary-500 hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_20px_rgba(96,255,92,0.25)]"
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
      <div class="absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(ellipse_at_top,_rgba(20,184,166,0.18),_transparent_55%)]"></div>
      <div class="absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_80%_20%,_rgba(96,255,92,0.08),_transparent_40%)]"></div>
      <div class="absolute inset-x-0 bottom-0 h-[320px] bg-[radial-gradient(ellipse_at_bottom,_rgba(96,255,92,0.06),_transparent_60%)]"></div>
    </div>
    <!-- Grid overlay matching landing page -->
    <div class="absolute inset-0 -z-10 opacity-[0.18]" aria-hidden="true" style="background-image:linear-gradient(to right,rgb(30 41 59/0.5) 1px,transparent 1px),linear-gradient(to bottom,rgb(30 41 59/0.5) 1px,transparent 1px);background-size:56px 56px;mask-image:radial-gradient(ellipse at center top,black 0%,transparent 70%)"></div>

    <div class="mx-auto max-w-3xl text-center">
      <span class="pricing-badge inline-flex items-center gap-2 rounded-full border border-primary-500/25 bg-primary-500/[0.08] px-4 py-1.5 text-xs font-medium text-primary-300 shadow-[0_0_16px_rgba(96,255,92,0.08)] backdrop-blur-sm">
        <Sparkles size={13} aria-hidden="true" class="animate-pulse" />
        Simple, hunter-friendly pricing
      </span>
      <h1 class="mt-8 text-balance text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
        Free forever. Pro when you need
        <span class="bg-gradient-to-br from-primary-200 via-primary-400 to-cyan-500 bg-clip-text text-transparent">
          real-time sync.
        </span>
      </h1>
      <p class="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-zinc-300 sm:text-lg">
        Every feature except cloud sync is free, forever, with no account required. Upgrade only when you want
        seamless real-time updates across every device you hunt from.
      </p>
    </div>
  </section>

  <!-- Live Clerk Billing pricing table (preferred) with a static fallback -->
  <section class="relative border-b border-white/[0.06] px-4 py-16 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-6xl">
      {#if $clerkAuthStore.signedIn && $clerkAuthStore.isPro}
        <!-- Signed-in Pro users see a clear "you're already subscribed" state
             with a direct link to manage billing instead of a confusing
             re-subscribe flow. -->
        <div class="mx-auto mb-10 max-w-2xl rounded-2xl border border-primary-500/40 bg-primary-500/10 p-6 text-center ring-1 ring-primary-500/20">
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-primary-500/30 bg-primary-500/15 text-primary-300">
            <Sparkles size={22} aria-hidden="true" />
          </div>
          <h2 class="mt-4 text-xl font-bold text-zinc-100">You&apos;re already on HuntFlow Pro</h2>
          <p class="mt-2 text-sm leading-6 text-zinc-300">
            Cloud sync, end-to-end encrypted evidence, and priority support are active on your account.
            Manage your plan, update your payment method, or download invoices below.
          </p>
          <div class="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              class="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
              on:click={handleManageSubscription}
              disabled={openingSubscriptions}
            >
              <CreditCard size={15} aria-hidden="true" />
              {openingSubscriptions ? 'Opening billing…' : 'Manage subscription'}
            </button>
            <a
              href="/account"
              class="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800/80 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700"
            >
              Back to the app
              <ArrowRight size={14} aria-hidden="true" />
            </a>
          </div>
        </div>
      {/if}

      {#if $clerkAuthStore.configured && !billingUnavailable && !($clerkAuthStore.signedIn && $clerkAuthStore.isPro)}
        <div
          bind:this={mountNode}
          class="hf-pricing-mount mx-auto max-w-4xl"
          data-mounted={billingMounted}
          data-unavailable={billingUnavailable}
        ></div>
        {#if billingEnabled && !billingMounted}
          <div class="mx-auto max-w-md rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-center text-sm text-zinc-400" aria-live="polite">
            Loading live pricing&hellip;
          </div>
        {/if}
      {/if}

      <!-- Static plan summary stays visible until the embedded Clerk Billing
           table produces actual visible pricing content, so the billing
           section never collapses into an empty gap. -->
      {#if showStaticPlans}
      <div class="mt-10 grid items-start gap-6 lg:grid-cols-2">
        <!-- FREE PLAN — The Foundation -->
        <article class="plan-card group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] p-7 backdrop-blur-sm transition-all duration-300 hover:border-white/[0.12]">
          <div class="absolute inset-0 -z-10 bg-gradient-to-b from-white/[0.02] to-transparent"></div>
          <div class="flex items-baseline justify-between gap-3">
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">The foundation</p>
              <h2 class="mt-1 text-2xl font-bold text-zinc-100">Free</h2>
              <p class="mt-1.5 text-sm leading-relaxed text-zinc-400">Every tool a hunter needs. No account, no limits, no catch.</p>
            </div>
            <p class="text-4xl font-bold text-zinc-200">$0</p>
          </div>
          <ul class="mt-7 flex-1 space-y-3 text-sm text-zinc-300">
            {#each freeFeatures as feature}
              <li class="flex items-start gap-3">
                <Check class="mt-0.5 shrink-0 text-zinc-500" size={16} aria-hidden="true" />
                <span>{feature}</span>
              </li>
            {/each}
          </ul>
          <a
            href="/account"
            class="mt-7 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[12px] border border-white/[0.08] bg-transparent px-4 py-2.5 text-sm font-medium text-zinc-400 transition hover:border-white/[0.16] hover:text-zinc-200 hover:bg-white/[0.04]"
          >
            {$clerkAuthStore.signedIn ? 'Back to the app' : 'Start hunting — free'}
          </a>
        </article>

        <!-- PRO PLAN — The Upgrade Path -->
        <article class="plan-card plan-card-pro group relative flex flex-col overflow-hidden rounded-2xl border border-primary-500/30 p-7 backdrop-blur-sm transition-all duration-300 hover:border-primary-500/50 hover:-tranzinc-y-0.5">
          <!-- Ambient glow behind card -->
          <div class="absolute -inset-px -z-10 rounded-2xl bg-gradient-to-b from-primary-500/[0.06] via-transparent to-primary-500/[0.03]" aria-hidden="true"></div>

          <!-- Recommended badge -->
          <span class="absolute -top-3 right-6 inline-flex items-center gap-1.5 rounded-full bg-primary-500 px-3.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-950 shadow-[0_0_12px_rgba(96,255,92,0.3)]">
            <Sparkles size={11} aria-hidden="true" />
            Recommended
          </span>

          <div class="flex items-baseline justify-between gap-3">
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-400/80">For serious hunters</p>
              <h2 class="mt-1 text-2xl font-bold text-white">Pro</h2>
              <p class="mt-1.5 text-sm leading-relaxed text-zinc-400">Real-time sync, E2E encryption, multi-device.</p>
            </div>
            <div class="text-right">
              <p class="text-4xl font-bold text-white">$6<span class="text-base font-medium text-zinc-400">/mo</span></p>
              <p class="mt-0.5 text-xs text-primary-400/70">$60/yr · <span class="font-semibold text-primary-400">save 17%</span></p>
            </div>
          </div>

          <!-- Separator with "Everything in Free, plus" anchor -->
          <div class="mt-7 flex items-center gap-3">
            <span class="text-[11px] font-medium text-zinc-500">Everything in Free, plus:</span>
            <div class="h-px flex-1 bg-white/[0.06]"></div>
          </div>

          <ul class="mt-4 flex-1 space-y-3 text-sm text-zinc-200">
            {#each proFeatures as feature}
              <li class="flex items-start gap-3">
                <Check class="mt-0.5 shrink-0 text-primary-400" size={16} aria-hidden="true" />
                <span>{feature}</span>
              </li>
            {/each}
          </ul>

          {#if $clerkAuthStore.signedIn && !billingUnavailable}
            <button
              type="button"
              class="pro-cta mt-7 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[12px] bg-primary-500 px-5 py-3 text-sm font-semibold text-zinc-950 shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_20px_rgba(96,255,92,0.2)] transition-all duration-200 hover:-tranzinc-y-0.5 hover:bg-primary-400 hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_32px_rgba(96,255,92,0.35)] active:tranzinc-y-0 disabled:cursor-not-allowed disabled:opacity-60"
              on:click={handleManageSubscription}
              disabled={openingSubscriptions}
            >
              <CreditCard size={15} aria-hidden="true" />
              {openingSubscriptions ? 'Opening billing…' : 'Open billing'}
            </button>
          {:else if $clerkAuthStore.signedIn}
            <a
              href="/account"
              class="pro-cta mt-7 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[12px] border border-white/[0.08] bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-white/[0.14] hover:bg-white/[0.08]"
            >
              Back to account
              <ArrowRight size={15} aria-hidden="true" />
            </a>
          {:else}
            <a
              href="/sign-up"
              class="pro-cta mt-7 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[12px] bg-primary-500 px-5 py-3 text-sm font-semibold text-zinc-950 shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_20px_rgba(96,255,92,0.2)] transition-all duration-200 hover:bg-primary-400 hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_32px_rgba(96,255,92,0.35)] hover:-tranzinc-y-0.5 active:tranzinc-y-0"
            >
              Get Pro — start free trial
              <ArrowRight size={15} aria-hidden="true" />
            </a>
          {/if}
        </article>
      </div>
      {/if}
    </div>
  </section>

  <!-- Pro value reminder, three concrete callouts -->
  <section class="relative border-b border-white/[0.06] px-4 py-20 sm:px-6 lg:px-8">
    <div class="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom,_rgba(96,255,92,0.04),_transparent_60%)]" aria-hidden="true"></div>
    <div class="mx-auto max-w-6xl">
      <p class="hf-eyebrow">What Pro buys you</p>
      <h2 class="mt-2 text-3xl font-bold leading-tight text-white sm:text-4xl">Three things, no fluff.</h2>

      <div class="mt-10 grid gap-5 md:grid-cols-3">
        <article class="value-card group relative overflow-hidden rounded-2xl border border-white/[0.08] p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary-500/30 hover:-tranzinc-y-0.5">
          <div class="absolute inset-0 -z-10 bg-gradient-to-br from-primary-500/[0.04] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
          <div class="flex h-11 w-11 items-center justify-center rounded-xl border border-primary-500/20 bg-primary-500/10 text-primary-400 shadow-[0_0_12px_rgba(96,255,92,0.08)] transition-shadow group-hover:shadow-[0_0_20px_rgba(96,255,92,0.15)]">
            <Cloud size={20} aria-hidden="true" />
          </div>
          <h3 class="mt-5 text-lg font-semibold text-white">Real-time sync</h3>
          <p class="mt-2.5 text-sm leading-6 text-zinc-400">
            Every edit is reflected on every signed-in device in under a second. Same data on laptop, phone, tablet.
          </p>
        </article>
        <article class="value-card group relative overflow-hidden rounded-2xl border border-white/[0.08] p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary-500/30 hover:-tranzinc-y-0.5">
          <div class="absolute inset-0 -z-10 bg-gradient-to-br from-primary-500/[0.04] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
          <div class="flex h-11 w-11 items-center justify-center rounded-xl border border-primary-500/20 bg-primary-500/10 text-primary-400 shadow-[0_0_12px_rgba(96,255,92,0.08)] transition-shadow group-hover:shadow-[0_0_20px_rgba(96,255,92,0.15)]">
            <Lock size={20} aria-hidden="true" />
          </div>
          <h3 class="mt-5 text-lg font-semibold text-white">Encrypted at rest</h3>
          <p class="mt-2.5 text-sm leading-6 text-zinc-400">
            Notes, evidence and report drafts are encrypted client-side. Even we can't read your findings.
          </p>
        </article>
        <article class="value-card group relative overflow-hidden rounded-2xl border border-white/[0.08] p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary-500/30 hover:-tranzinc-y-0.5">
          <div class="absolute inset-0 -z-10 bg-gradient-to-br from-primary-500/[0.04] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
          <div class="flex h-11 w-11 items-center justify-center rounded-xl border border-primary-500/20 bg-primary-500/10 text-primary-400 shadow-[0_0_12px_rgba(96,255,92,0.08)] transition-shadow group-hover:shadow-[0_0_20px_rgba(96,255,92,0.15)]">
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
    <div class="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_rgba(20,184,166,0.08),_transparent_60%)]" aria-hidden="true"></div>
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
          class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] bg-primary-600 px-6 py-3 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_12px_rgba(96,255,92,0.15)] transition hover:bg-primary-500 hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_20px_rgba(96,255,92,0.25)]"
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
            src="/brand/huntflow-mark.jpg"
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
          <a
            class="mt-2 inline-flex items-center gap-2 text-zinc-300 hover:text-zinc-100"
            href="https://x.com/xalgord"
            rel="noreferrer"
          >
            <Twitter size={14} aria-hidden="true" />
            Twitter
          </a>
        </div>
      </div>
    </div>

    <div class="mx-auto mt-10 max-w-6xl border-t border-white/[0.06] pt-6 text-xs text-zinc-600">
      &copy; 2026 HuntFlow. All rights reserved.
    </div>
  </footer>
</div>
{/if}

<style>
  /* ─── Clerk PricingTable deep theme ───────────────────────────────
     Override Clerk's default component styles so the embedded pricing
     widget feels native to HuntFlow's dark, glassmorphic design system. */

  /* Root / wrapper resets */
  :global(.hf-pricing-mount .cl-pricingTable),
  :global(.hf-pricing-mount .cl-rootBox),
  :global(.hf-pricing-mount .cl-card) {
    background: transparent !important;
    box-shadow: none !important;
  }

  /* ── Plan cards ────────────────────────────────────────────────── */
  :global(.hf-pricing-mount .cl-pricingTableCard) {
    background: linear-gradient(
      168deg,
      hsl(150 14% 7% / 0.85),
      hsl(140 18% 3% / 0.95)
    ) !important;
    border: 1px solid hsl(150 12% 17% / 0.7) !important;
    border-radius: 1rem !important;
    box-shadow:
      0 0 0 1px hsl(0 0% 100% / 0.04) inset,
      0 1px 0 hsl(0 0% 100% / 0.05) inset,
      0 16px 48px -12px rgba(0, 0, 0, 0.5) !important;
    backdrop-filter: blur(16px) !important;
    transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
    overflow: hidden !important;
  }

  :global(.hf-pricing-mount .cl-pricingTableCard:hover) {
    border-color: hsl(119 100% 67% / 0.25) !important;
    box-shadow:
      0 0 0 1px hsl(0 0% 100% / 0.04) inset,
      0 1px 0 hsl(0 0% 100% / 0.05) inset,
      0 16px 48px -12px rgba(0, 0, 0, 0.5),
      0 0 24px -4px hsl(119 100% 67% / 0.08) !important;
  }

  /* Highlighted / recommended plan card */
  :global(.hf-pricing-mount .cl-pricingTableCard[data-highlighted='true']),
  :global(.hf-pricing-mount .cl-pricingTableCard:has(.cl-badge)) {
    border-color: hsl(119 100% 67% / 0.35) !important;
    background: linear-gradient(
      168deg,
      hsl(119 60% 14% / 0.15),
      hsl(150 14% 7% / 0.85),
      hsl(140 18% 3% / 0.95)
    ) !important;
    box-shadow:
      0 0 0 1px hsl(119 100% 67% / 0.1) inset,
      0 1px 0 hsl(0 0% 100% / 0.06) inset,
      0 16px 48px -12px rgba(0, 0, 0, 0.5),
      0 0 32px -4px hsl(119 100% 67% / 0.12) !important;
  }

  /* "Active" badge on the current plan card */
  :global(.hf-pricing-mount .cl-badge) {
    background: hsl(119 100% 67% / 0.15) !important;
    color: hsl(119 100% 78%) !important;
    border: 1px solid hsl(119 100% 67% / 0.4) !important;
    border-radius: 9999px !important;
    font-size: 0.6875rem !important;
    font-weight: 600 !important;
    letter-spacing: 0.06em !important;
    padding: 0.2rem 0.65rem !important;
  }

  /* ── Typography ────────────────────────────────────────────────── */
  :global(.hf-pricing-mount .cl-pricingTableCardTitle),
  :global(.hf-pricing-mount h2),
  :global(.hf-pricing-mount h3) {
    color: hsl(150 28% 94%) !important;
    font-weight: 700 !important;
  }

  :global(.hf-pricing-mount .cl-pricingTableCardSubtitle),
  :global(.hf-pricing-mount .cl-pricingTableCardDescription),
  :global(.hf-pricing-mount p) {
    color: hsl(150 7% 64%) !important;
  }

  /* Price figures */
  :global(.hf-pricing-mount .cl-pricingTableCardPrice),
  :global(.hf-pricing-mount [class*='price']) {
    color: hsl(150 28% 94%) !important;
    font-weight: 800 !important;
  }

  :global(.hf-pricing-mount .cl-pricingTableCardPricePeriod),
  :global(.hf-pricing-mount [class*='period']) {
    color: hsl(150 7% 64%) !important;
    font-weight: 400 !important;
  }

  /* ── Feature checkmarks / list ─────────────────────────────────── */
  :global(.hf-pricing-mount .cl-pricingTableCardFeatureList),
  :global(.hf-pricing-mount ul) {
    color: hsl(150 28% 94%) !important;
  }

  :global(.hf-pricing-mount .cl-pricingTableCardFeatureListItem),
  :global(.hf-pricing-mount li) {
    color: hsl(150 18% 80%) !important;
    border-color: hsl(150 12% 17% / 0.5) !important;
  }

  /* Checkmark icons */
  :global(.hf-pricing-mount .cl-pricingTableCardFeatureListItem svg),
  :global(.hf-pricing-mount li svg) {
    color: hsl(119 100% 67%) !important;
  }

  /* ── CTA / Subscribe button ────────────────────────────────────── */
  :global(.hf-pricing-mount .cl-formButtonPrimary),
  :global(.hf-pricing-mount button[class*='primary']),
  :global(.hf-pricing-mount .cl-pricingTableCardAction button) {
    background: hsl(119 100% 67%) !important;
    color: hsl(140 26% 3%) !important;
    font-weight: 600 !important;
    border: none !important;
    border-radius: 0.75rem !important;
    padding: 0.7rem 1.5rem !important;
    min-height: 44px !important;
    transition: all 0.2s ease !important;
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.3),
      0 0 16px -4px hsl(119 100% 67% / 0.3) !important;
  }

  :global(.hf-pricing-mount .cl-formButtonPrimary:hover),
  :global(.hf-pricing-mount button[class*='primary']:hover),
  :global(.hf-pricing-mount .cl-pricingTableCardAction button:hover) {
    background: hsl(119 100% 72%) !important;
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.3),
      0 0 24px -4px hsl(119 100% 67% / 0.5) !important;
    transform: translateY(-1px) !important;
  }

  :global(.hf-pricing-mount .cl-formButtonPrimary:active),
  :global(.hf-pricing-mount button[class*='primary']:active),
  :global(.hf-pricing-mount .cl-pricingTableCardAction button:active) {
    transform: translateY(0) !important;
  }

  /* "Current plan" or secondary state buttons */
  :global(.hf-pricing-mount button[disabled]),
  :global(.hf-pricing-mount button:disabled) {
    background: hsl(150 10% 11%) !important;
    color: hsl(150 7% 64%) !important;
    border: 1px solid hsl(150 12% 17%) !important;
    box-shadow: none !important;
    transform: none !important;
    cursor: default !important;
  }

  /* ── Toggle / billing period switch ────────────────────────────── */
  :global(.hf-pricing-mount [class*='toggle']),
  :global(.hf-pricing-mount [class*='switch']),
  :global(.hf-pricing-mount [class*='period']) {
    color: hsl(150 7% 64%) !important;
  }

  :global(.hf-pricing-mount input[type='checkbox']),
  :global(.hf-pricing-mount [role='switch']) {
    background: hsl(150 10% 14%) !important;
    border-color: hsl(150 12% 17%) !important;
  }

  :global(.hf-pricing-mount input[type='checkbox']:checked),
  :global(.hf-pricing-mount [role='switch'][aria-checked='true']) {
    background: hsl(119 100% 67% / 0.25) !important;
    border-color: hsl(119 100% 67% / 0.5) !important;
  }

  /* ── Dividers & misc ───────────────────────────────────────────── */
  :global(.hf-pricing-mount .cl-dividerLine),
  :global(.hf-pricing-mount hr) {
    background: hsl(150 12% 17% / 0.6) !important;
    border-color: hsl(150 12% 17% / 0.6) !important;
  }

  :global(.hf-pricing-mount .cl-footer),
  :global(.hf-pricing-mount .cl-footerItem),
  :global(.hf-pricing-mount [class*='footer']) {
    color: hsl(150 7% 50%) !important;
    background: transparent !important;
  }

  /* Powered-by link — keep it subtle */
  :global(.hf-pricing-mount .cl-internal-b3fm6y) {
    display: none !important;
  }

  /* ─── Pricing page scoped animations ─────────────────────────── */

  .pricing-page {
    background:
      linear-gradient(180deg, hsl(140 18% 3%) 0%, hsl(140 20% 2%) 100%);
  }

  .pricing-hero {
    animation: hero-fade-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .pricing-badge {
    animation: badge-slide-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both;
  }

  .value-card {
    background:
      linear-gradient(180deg, hsl(var(--primary) / 0.025), transparent 40%),
      hsl(150 14% 7% / 0.6);
    box-shadow:
      inset 0 1px 0 hsl(0 0% 100% / 0.04),
      0 16px 48px -12px rgba(0, 0, 0, 0.35);
  }

  .value-card:nth-child(1) { animation: card-slide-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both; }
  .value-card:nth-child(2) { animation: card-slide-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.2s both; }
  .value-card:nth-child(3) { animation: card-slide-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both; }

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

  /* Plan cards entrance */
  .plan-card {
    animation: card-slide-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both;
    background:
      linear-gradient(180deg, hsl(150 10% 6% / 0.6), hsl(150 14% 4% / 0.8));
    box-shadow:
      inset 0 1px 0 hsl(0 0% 100% / 0.03),
      0 8px 32px -8px rgba(0, 0, 0, 0.3);
  }
  .plan-card-pro {
    animation-delay: 0.25s;
    background:
      linear-gradient(168deg,
        hsl(119 60% 14% / 0.08),
        hsl(150 14% 7% / 0.85),
        hsl(140 18% 3% / 0.95)
      );
    box-shadow:
      inset 0 1px 0 hsl(0 0% 100% / 0.05),
      0 16px 48px -12px rgba(0, 0, 0, 0.4),
      0 0 40px -8px hsl(119 100% 67% / 0.06);
  }

  /* Pro CTA pulse glow on idle */
  .pro-cta {
    position: relative;
  }
  .pro-cta::after {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    background: hsl(119 100% 67% / 0.12);
    filter: blur(12px);
    opacity: 0;
    transition: opacity 0.3s ease;
    z-index: -1;
  }
  .pro-cta:hover::after {
    opacity: 1;
  }
</style>
