<script lang="ts">
  import { browser } from '$app/environment';
  import {
    BarChart3,
    Check,
    Cloud,
    Crosshair,
    FileText,
    Github,
    ShieldCheck,
    Target,
    Timer,
    WifiOff,
    X
  } from 'lucide-svelte';
  import { onDestroy, onMount } from 'svelte';
  import type { ComponentType } from 'svelte';

  type BeforeInstallPromptEvent = Event & {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  };

  interface Feature {
    icon: ComponentType;
    title: string;
    description: string;
  }

  interface Step {
    title: string;
    description: string;
  }

  interface PlanFeature {
    label: string;
    free: boolean;
    pro: boolean;
  }

  let deferredPrompt: BeforeInstallPromptEvent | null = null;
  let installMessage = '';
  let isStandalone = false;

  const features: Feature[] = [
    {
      icon: Timer,
      title: 'Focus sessions',
      description: 'Run timed hunts, label every session by target, and keep wall-clock accurate progress.'
    },
    {
      icon: FileText,
      title: 'Security notes',
      description: 'Use vulnerability templates for SSRF, IDOR, XSS, SQLi, auth bypass, and more.'
    },
    {
      icon: BarChart3,
      title: 'Streaks and stats',
      description: 'Track hunting time, best streaks, active targets, and your strongest vulnerability areas.'
    }
  ];

  const steps: Step[] = [
    {
      title: 'Pick a target',
      description: 'Add a program, scope, platform, and priority so every session has context.'
    },
    {
      title: 'Start a focused hunt',
      description: 'Choose a template, run the timer, and capture quick findings before context fades.'
    },
    {
      title: 'Review the pattern',
      description: 'Use stats and linked notes to keep momentum and turn discoveries into cleaner reports.'
    }
  ];

  const planFeatures: PlanFeature[] = [
    { label: 'Focus sessions and history', free: true, pro: true },
    { label: 'Target tracker and status pipeline', free: true, pro: true },
    { label: 'Offline-first local data', free: true, pro: true },
    { label: 'Core vulnerability templates', free: true, pro: true },
    { label: 'Unlimited custom templates', free: false, pro: true },
    { label: 'Cloud sync across devices', free: false, pro: true },
    { label: 'Report builder and income tracker', free: false, pro: true }
  ];

  function handleBeforeInstallPrompt(event: Event): void {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    installMessage = '';
  }

  async function installApp(): Promise<void> {
    if (isStandalone) {
      installMessage = 'HuntFlow is already installed on this device.';
      return;
    }

    if (!deferredPrompt) {
      installMessage = 'Use your browser menu to add HuntFlow to your home screen.';
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    installMessage =
      choice.outcome === 'accepted'
        ? 'Install started. HuntFlow will be available from your home screen.'
        : 'Install dismissed. You can try again from this button later.';
    deferredPrompt = null;
  }

  onMount(() => {
    if (!browser) return;

    isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  });

  onDestroy(() => {
    if (!browser) return;
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  });
</script>

<svelte:head>
  <title>HuntFlow | Bug bounty workflow OS</title>
  <meta
    name="description"
    content="HuntFlow is a dark, offline-first workspace for bug bounty hunters to manage targets, timed sessions, evidence notes, reports, payouts, and cloud sync."
  />
  <meta property="og:title" content="HuntFlow | Bug bounty workflow OS" />
  <meta
    property="og:description"
    content="A focused bug bounty workspace for targets, sessions, notes, reports, payouts, and cloud sync."
  />
  <meta name="twitter:title" content="HuntFlow | Bug bounty workflow OS" />
  <meta
    name="twitter:description"
    content="A focused bug bounty workspace for targets, sessions, notes, reports, payouts, and cloud sync."
  />
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "HuntFlow",
      "applicationCategory": "ProductivityApplication",
      "operatingSystem": "Web",
      "description": "Offline-first bug bounty workspace for targets, focused sessions, notes, reports, payouts, and cloud sync.",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      }
    }
  </script>
</svelte:head>

<main class="landing-page min-h-screen overflow-hidden bg-slate-950 text-slate-100">
  <section class="relative isolate min-h-screen border-b border-slate-800">
    <div class="absolute inset-0 -z-10 bg-slate-950" aria-hidden="true">
      <div class="absolute inset-0 bg-slate-950"></div>
      <div class="absolute left-1/2 top-24 hidden w-[680px] -translate-x-1/2 rotate-[-6deg] opacity-45 md:block">
        <div class="rounded-lg border border-slate-700 bg-slate-900/95 p-4 shadow-dark-xl">
          <div class="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
            <div class="flex items-center gap-2 text-xs font-semibold uppercase text-primary-400">
              <Crosshair size={16} aria-hidden="true" />
              Hunt session
            </div>
            <div class="font-mono text-sm text-slate-400">24:37</div>
          </div>
          <div class="grid grid-cols-[1.2fr_0.8fr] gap-3">
            <div class="space-y-3">
              <div class="h-3 w-3/4 rounded-full bg-slate-700"></div>
              <div class="h-3 w-1/2 rounded-full bg-primary-500"></div>
              <div class="h-24 rounded-md border border-slate-800 bg-slate-950 p-3">
                <div class="mb-2 h-2 w-2/3 rounded-full bg-slate-700"></div>
                <div class="mb-2 h-2 w-5/6 rounded-full bg-slate-800"></div>
                <div class="h-2 w-1/2 rounded-full bg-slate-800"></div>
              </div>
            </div>
            <div class="grid grid-cols-4 gap-2">
              {#each Array(28) as _, index}
                <div
                  class="aspect-square rounded-sm border border-slate-800 {index % 5 === 0
                    ? 'bg-primary-500'
                    : index % 3 === 0
                      ? 'bg-primary-700'
                      : 'bg-slate-800'}"
                ></div>
              {/each}
            </div>
          </div>
        </div>
      </div>
    </div>

    <header class="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
      <a href="/landing" class="flex min-h-[44px] items-center gap-3 text-slate-100">
        <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600 text-white">
          <Crosshair size={21} aria-hidden="true" />
        </span>
        <span class="text-base font-semibold">HuntFlow</span>
      </a>
      <nav class="hidden items-center gap-6 text-sm text-slate-400 sm:flex" aria-label="Landing navigation">
        <a class="transition hover:text-slate-100" href="#features">Features</a>
        <a class="transition hover:text-slate-100" href="#pricing">Pricing</a>
        <a class="transition hover:text-slate-100" href="/">Open App</a>
      </nav>
    </header>

    <div class="mx-auto flex min-h-[calc(100vh-84px)] max-w-6xl items-center px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <div class="max-w-3xl">
        <div class="inline-flex items-center gap-2 rounded-md border border-primary-500/30 bg-slate-900/80 px-3 py-2 text-xs font-semibold uppercase text-primary-300">
          <WifiOff size={15} aria-hidden="true" />
          Offline-first PWA for bug bounty hunters
        </div>
        <h1 class="mt-6 max-w-3xl text-5xl font-semibold leading-tight tracking-normal text-white sm:text-6xl lg:text-7xl">
          HuntFlow
        </h1>
        <p class="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
          A private command center for bug bounty work: targets, timed hunts, evidence notes, report drafts, payout
          tracking, and cloud sync in one focused workspace.
        </p>
        <div class="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary-600 px-6 py-3 text-base font-medium text-white shadow-sm transition hover:bg-primary-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            on:click={installApp}
          >
            <Cloud size={20} aria-hidden="true" />
            Install App
          </button>
          <a
            href="/"
            class="inline-flex min-h-[44px] items-center justify-center rounded-md border border-slate-600 bg-slate-800 px-6 py-3 text-base font-medium text-slate-100 transition hover:bg-slate-700"
          >
            Open Dashboard
          </a>
        </div>
        {#if installMessage}
          <p class="mt-3 max-w-xl text-sm leading-6 text-slate-400" aria-live="polite">{installMessage}</p>
        {/if}
        <div class="mt-8 grid max-w-xl grid-cols-3 gap-3 text-sm text-slate-400">
          <div class="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
            <strong class="block text-lg text-slate-100">25m</strong>
            Focus loop
          </div>
          <div class="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
            <strong class="block text-lg text-slate-100">8</strong>
            Templates
          </div>
          <div class="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
            <strong class="block text-lg text-slate-100">0</strong>
            Backend required
          </div>
        </div>
      </div>
    </div>
  </section>

  <section id="features" class="border-b border-slate-800 bg-slate-900 px-4 py-16 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-6xl">
      <div class="max-w-2xl">
        <p class="hf-eyebrow">Features</p>
        <h2 class="mt-2 text-3xl font-bold leading-tight text-slate-100">Built around the hunting workflow.</h2>
        <p class="mt-3 text-sm leading-6 text-slate-400">
          No generic tracker glue. HuntFlow keeps sessions, notes, targets, and stats connected locally.
        </p>
      </div>

      <div class="mt-8 grid gap-4 md:grid-cols-3">
        {#each features as feature}
          <article class="rounded-lg border border-slate-700 bg-slate-800 p-5 shadow-dark-sm">
            <div class="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-500/10 text-primary-400">
              <svelte:component this={feature.icon} size={22} aria-hidden="true" />
            </div>
            <h3 class="mt-4 text-xl font-semibold text-slate-100">{feature.title}</h3>
            <p class="mt-2 text-sm leading-6 text-slate-400">{feature.description}</p>
          </article>
        {/each}
      </div>
    </div>
  </section>

  <section class="border-b border-slate-800 bg-slate-950 px-4 py-16 sm:px-6 lg:px-8">
    <div class="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
      <div>
        <p class="hf-eyebrow">How it works</p>
        <h2 class="mt-2 text-3xl font-bold leading-tight text-slate-100">A three-step loop for consistent hunts.</h2>
      </div>
      <div class="grid gap-4">
        {#each steps as step, index}
          <article class="grid gap-4 rounded-lg border border-slate-800 bg-slate-900 p-5 sm:grid-cols-[56px_1fr]">
            <div class="flex h-12 w-12 items-center justify-center rounded-lg border border-primary-500/30 bg-slate-950 text-lg font-bold text-primary-300">
              {index + 1}
            </div>
            <div>
              <h3 class="text-xl font-semibold text-slate-100">{step.title}</h3>
              <p class="mt-2 text-sm leading-6 text-slate-400">{step.description}</p>
            </div>
          </article>
        {/each}
      </div>
    </div>
  </section>

  <section id="pricing" class="border-b border-slate-800 bg-slate-900 px-4 py-16 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-6xl">
      <div class="max-w-2xl">
        <p class="hf-eyebrow">Pricing</p>
        <h2 class="mt-2 text-3xl font-bold leading-tight text-slate-100">Start free. Upgrade when reports need speed.</h2>
        <p class="mt-3 text-sm leading-6 text-slate-400">
          The free tier is useful on day one. Pro is for hunters who want sync, report generation, and income tracking.
        </p>
      </div>

      <div class="mt-8 grid gap-4 lg:grid-cols-2">
        <article class="rounded-lg border border-slate-700 bg-slate-800 p-6 shadow-dark-sm">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-2xl font-bold text-slate-100">Free</h3>
              <p class="mt-1 text-sm text-slate-400">For building the daily hunting habit.</p>
            </div>
            <p class="text-3xl font-bold text-white">$0</p>
          </div>
          <ul class="mt-6 space-y-3">
            {#each planFeatures as item}
              <li class="flex items-center gap-3 text-sm {item.free ? 'text-slate-200' : 'text-slate-500'}">
                {#if item.free}
                  <Check class="shrink-0 text-primary-400" size={18} aria-hidden="true" />
                {:else}
                  <X class="shrink-0 text-slate-600" size={18} aria-hidden="true" />
                {/if}
                {item.label}
              </li>
            {/each}
          </ul>
        </article>

        <article class="rounded-lg border border-primary-500/30 bg-slate-800 p-6 shadow-dark-md">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-2xl font-bold text-slate-100">Pro</h3>
              <p class="mt-1 text-sm text-slate-400">For active hunters working across platforms.</p>
            </div>
            <div class="text-right">
              <p class="text-3xl font-bold text-white">$6</p>
              <p class="text-xs text-slate-400">per month</p>
            </div>
          </div>
          <ul class="mt-6 space-y-3">
            {#each planFeatures as item}
              <li class="flex items-center gap-3 text-sm text-slate-200">
                <Check class="shrink-0 text-primary-400" size={18} aria-hidden="true" />
                {item.label}
              </li>
            {/each}
          </ul>
        </article>
      </div>
    </div>
  </section>

  <footer class="bg-slate-950 px-4 py-10 sm:px-6 lg:px-8">
    <div class="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
      <div>
        <div class="flex items-center gap-3 text-slate-100">
          <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white">
            <ShieldCheck size={19} aria-hidden="true" />
          </span>
          <span class="font-semibold">HuntFlow</span>
        </div>
        <p class="mt-3 max-w-md text-sm leading-6 text-slate-500">
          Offline-first productivity for bug bounty hunters. (c) 2026 HuntFlow.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-4 text-sm text-slate-400">
        <a class="transition hover:text-slate-100" href="/">App</a>
        <a class="transition hover:text-slate-100" href="#features">Features</a>
        <a class="transition hover:text-slate-100" href="#pricing">Pricing</a>
        <a class="inline-flex items-center gap-2 transition hover:text-slate-100" href="https://github.com" rel="noreferrer">
          <Github size={17} aria-hidden="true" />
          GitHub
        </a>
        <a class="inline-flex items-center gap-2 transition hover:text-slate-100" href="https://x.com" rel="noreferrer">
          <Target size={17} aria-hidden="true" />
          X
        </a>
      </div>
    </div>
  </footer>
</main>

<style>
  :global(html.light) .landing-page:global(.bg-slate-950),
  :global(html.light) .landing-page :global(section.bg-slate-950),
  :global(html.light) .landing-page :global(footer.bg-slate-950) {
    background-color: #020617;
  }

  :global(html.light) .landing-page :global(section.bg-slate-900),
  :global(html.light) .landing-page :global(div.bg-slate-900),
  :global(html.light) .landing-page :global(article.bg-slate-900) {
    background-color: #0f172a;
  }

  :global(html.light) .landing-page :global(article.bg-slate-800),
  :global(html.light) .landing-page :global(a.bg-slate-800),
  :global(html.light) .landing-page :global(div.bg-slate-800) {
    background-color: #1e293b;
  }

  :global(html.light) .landing-page :global(.text-slate-100),
  :global(html.light) .landing-page :global(.text-slate-200),
  :global(html.light) .landing-page :global(.text-white) {
    color: #f1f5f9;
  }

  :global(html.light) .landing-page :global(.text-slate-300) {
    color: #cbd5e1;
  }

  :global(html.light) .landing-page :global(.text-slate-400) {
    color: #94a3b8;
  }

  :global(html.light) .landing-page :global(.text-slate-500) {
    color: #64748b;
  }

  :global(html.light) .landing-page :global(.border-slate-800) {
    border-color: #1e293b;
  }

  :global(html.light) .landing-page :global(.border-slate-700) {
    border-color: #334155;
  }

  :global(html.light) .landing-page :global(.border-slate-600) {
    border-color: #475569;
  }
</style>
