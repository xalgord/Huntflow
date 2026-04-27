<script lang="ts">
  import { browser } from '$app/environment';
  import { clerkAuthStore, mountClerkPricingTable } from '$lib/cloud/clerk';
  import {
    ArrowRight,
    Check,
    Cloud,
    Crosshair,
    Lock,
    Smartphone,
    Sparkles
  } from 'lucide-svelte';
  import { onDestroy, onMount } from 'svelte';

  let mountNode: HTMLDivElement | null = null;
  let unmount: (() => void) | null = null;
  let billingMounted = false;

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

  onMount(async () => {
    if (!browser || !mountNode) return;
    unmount = await mountClerkPricingTable(mountNode, {
      // forSignedOutFlow lets visitors see the table without an account.
      // Clicking a paid plan redirects them through sign-up + checkout.
      newSubscriptionRedirectUrl: '/?welcome=pro',
      checkoutContinueUrl: '/?welcome=pro'
    });
    billingMounted = true;
  });

  onDestroy(() => {
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

<div class="pricing-page min-h-screen overflow-hidden bg-slate-950 text-slate-100">
  <header class="border-b border-slate-900 bg-slate-950/90 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
      <a href="/landing" class="flex min-h-[44px] items-center gap-2.5 text-slate-100">
        <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white">
          <Crosshair size={18} aria-hidden="true" />
        </span>
        <span class="text-base font-semibold tracking-tight">HuntFlow</span>
      </a>

      <nav class="hidden items-center gap-7 text-sm text-slate-400 md:flex" aria-label="Pricing nav">
        <a class="transition hover:text-slate-100" href="/landing#features">Features</a>
        <a class="transition hover:text-slate-100" href="/landing#cloud-sync">Cloud Sync</a>
        <a class="transition hover:text-slate-100" href="/landing#faq">FAQ</a>
      </nav>

      <div class="flex items-center gap-2">
        {#if $clerkAuthStore.signedIn}
          <a
            href="/"
            class="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-md bg-primary-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-500"
          >
            Open app
            <ArrowRight size={14} aria-hidden="true" />
          </a>
        {:else}
          <a
            href="/sign-in"
            class="hidden min-h-[36px] items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:text-slate-100 sm:inline-flex"
          >
            Sign in
          </a>
          <a
            href="/sign-up"
            class="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-md bg-primary-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-500"
          >
            Get started
          </a>
        {/if}
      </div>
    </div>
  </header>

  <section class="relative isolate border-b border-slate-800 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
    <div class="absolute inset-0 -z-10" aria-hidden="true">
      <div class="absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,_rgba(20,184,166,0.18),_transparent_55%)]"></div>
    </div>

    <div class="mx-auto max-w-3xl text-center">
      <span class="inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-slate-900/80 px-3 py-1 text-xs font-medium text-primary-200">
        <Sparkles size={13} aria-hidden="true" />
        Simple, hunter-friendly pricing
      </span>
      <h1 class="mt-6 text-balance text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
        Free forever. Pro when you need
        <span class="bg-gradient-to-br from-primary-200 via-primary-400 to-cyan-500 bg-clip-text text-transparent">
          real-time sync.
        </span>
      </h1>
      <p class="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
        Every feature except cloud sync is free, forever, with no account required. Upgrade only when you want
        Notion-style real-time updates across every device you hunt from.
      </p>
    </div>
  </section>

  <!-- Live Clerk Billing pricing table (preferred) with a static fallback -->
  <section class="border-b border-slate-800 px-4 py-16 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-6xl">
      {#if $clerkAuthStore.configured}
        <div
          bind:this={mountNode}
          class="hf-pricing-mount mx-auto max-w-4xl"
          data-mounted={billingMounted}
        ></div>
        {#if !billingMounted}
          <div class="mx-auto max-w-md rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-sm text-slate-400" aria-live="polite">
            Loading live pricing&hellip;
          </div>
        {/if}
      {/if}

      <!-- Static plan summary always visible: this is the source of truth for
           visitors before they create an account, and a fallback when Clerk
           Billing isn't configured. -->
      <div class="mt-10 grid gap-5 lg:grid-cols-2">
        <article class="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-dark-sm">
          <div class="flex items-baseline justify-between gap-3">
            <div>
              <h2 class="text-2xl font-bold text-slate-100">Free</h2>
              <p class="mt-1 text-sm text-slate-400">For local-first hunters who want every tool in one place.</p>
            </div>
            <p class="text-4xl font-bold text-white">$0</p>
          </div>
          <ul class="mt-7 flex-1 space-y-3 text-sm text-slate-200">
            {#each freeFeatures as feature}
              <li class="flex items-start gap-3">
                <Check class="mt-0.5 shrink-0 text-primary-400" size={16} aria-hidden="true" />
                <span>{feature}</span>
              </li>
            {/each}
          </ul>
          <a
            href="/"
            class="mt-7 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-700"
          >
            Open the app
          </a>
        </article>

        <article class="relative flex flex-col rounded-2xl border border-primary-500/40 bg-gradient-to-br from-slate-900 to-slate-900/40 p-6 shadow-dark-md ring-1 ring-primary-500/20">
          <span class="absolute -top-3 right-6 inline-flex items-center gap-1 rounded-full bg-primary-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-950">
            <Sparkles size={11} aria-hidden="true" />
            Cloud sync
          </span>

          <div class="flex items-baseline justify-between gap-3">
            <div>
              <h2 class="text-2xl font-bold text-slate-100">Pro</h2>
              <p class="mt-1 text-sm text-slate-400">For hunters working across multiple devices.</p>
            </div>
            <div class="text-right">
              <p class="text-4xl font-bold text-white">$6<span class="text-base font-medium text-slate-400">/mo</span></p>
              <p class="text-xs text-slate-500">or $60 billed yearly</p>
            </div>
          </div>

          <ul class="mt-7 flex-1 space-y-3 text-sm text-slate-200">
            {#each proFeatures as feature}
              <li class="flex items-start gap-3">
                <Check class="mt-0.5 shrink-0 text-primary-400" size={16} aria-hidden="true" />
                <span>{feature}</span>
              </li>
            {/each}
          </ul>

          {#if $clerkAuthStore.signedIn}
            <p class="mt-7 rounded-md border border-slate-800 bg-slate-950/60 p-3 text-center text-xs text-slate-400">
              {$clerkAuthStore.isPro
                ? 'You are on the Pro plan. Manage your subscription from your profile.'
                : 'Use the live pricing table above to upgrade.'}
            </p>
          {:else}
            <a
              href="/sign-up"
              class="mt-7 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-500"
            >
              Create account &amp; upgrade
              <ArrowRight size={14} aria-hidden="true" />
            </a>
          {/if}
        </article>
      </div>
    </div>
  </section>

  <!-- Pro value reminder, three concrete callouts -->
  <section class="border-b border-slate-800 bg-slate-900 px-4 py-16 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-6xl">
      <p class="hf-eyebrow">What Pro buys you</p>
      <h2 class="mt-2 text-3xl font-bold leading-tight text-slate-100 sm:text-4xl">Three things, no fluff.</h2>

      <div class="mt-8 grid gap-4 md:grid-cols-3">
        <article class="rounded-xl border border-slate-800 bg-slate-950 p-6">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10 text-primary-300">
            <Cloud size={20} aria-hidden="true" />
          </div>
          <h3 class="mt-4 text-lg font-semibold text-slate-100">Real-time sync</h3>
          <p class="mt-2 text-sm leading-6 text-slate-400">
            Every edit is reflected on every signed-in device in under a second. Same data on laptop, phone, tablet.
          </p>
        </article>
        <article class="rounded-xl border border-slate-800 bg-slate-950 p-6">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10 text-primary-300">
            <Lock size={20} aria-hidden="true" />
          </div>
          <h3 class="mt-4 text-lg font-semibold text-slate-100">Encrypted at rest</h3>
          <p class="mt-2 text-sm leading-6 text-slate-400">
            Notes, evidence and report drafts are encrypted client-side. Even we can't read your findings.
          </p>
        </article>
        <article class="rounded-xl border border-slate-800 bg-slate-950 p-6">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10 text-primary-300">
            <Smartphone size={20} aria-hidden="true" />
          </div>
          <h3 class="mt-4 text-lg font-semibold text-slate-100">Mobile-friendly</h3>
          <p class="mt-2 text-sm leading-6 text-slate-400">
            Capture a finding on your phone the moment you spot it. It is on your laptop before you sit down.
          </p>
        </article>
      </div>
    </div>
  </section>

  <footer class="bg-slate-950 px-4 py-10 sm:px-6 lg:px-8">
    <div class="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
      <p>&copy; 2026 HuntFlow. All rights reserved.</p>
      <div class="flex flex-wrap items-center gap-4">
        <a class="hover:text-slate-200" href="/landing">Home</a>
        <a class="hover:text-slate-200" href="/landing#features">Features</a>
        <a class="hover:text-slate-200" href="/landing#faq">FAQ</a>
      </div>
    </div>
  </footer>
</div>

<style>
  /* Reset Clerk's default surface so the embedded PricingTable visually
     belongs in our slate-950 frame rather than its own white card. */
  :global(.hf-pricing-mount .cl-pricingTable),
  :global(.hf-pricing-mount .cl-pricingTableCard),
  :global(.hf-pricing-mount .cl-rootBox),
  :global(.hf-pricing-mount .cl-card) {
    background: transparent !important;
    box-shadow: none !important;
  }
</style>
