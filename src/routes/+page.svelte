<script lang="ts">
  import { browser } from '$app/environment';
  import FaqSection from '$lib/components/landing/FaqSection.svelte';
  import FeatureGrid from '$lib/components/landing/FeatureGrid.svelte';
  import InstallCommand from '$lib/components/landing/InstallCommand.svelte';
  import ProSpotlight from '$lib/components/landing/ProSpotlight.svelte';
  import ScreenshotShowcase from '$lib/components/landing/ScreenshotShowcase.svelte';
  import {
    ArrowRight,
    Check,
    Crosshair,
    Github,
    LayoutDashboard,
    Sparkles,
    Twitter,
    WifiOff,
    X as XIcon
  } from 'lucide-svelte';
  import { onDestroy, onMount } from 'svelte';

  type BeforeInstallPromptEvent = Event & {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  };

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

  const steps: Step[] = [
    {
      title: 'Pick a target',
      description:
        'Add a program with platform, scope rules and priority. The scope validator catches out-of-scope URLs before you waste time.'
    },
    {
      title: 'Run a focused hunt',
      description:
        'Start the timer. Use a vulnerability template. Capture evidence on the canvas. Quick-tag everything so search works later.'
    },
    {
      title: 'Ship the report',
      description:
        'Drag findings into a draft, link evidence, attach the request/response, and export. Track payout and acceptance rate per program.'
    }
  ];

  const planFeatures: PlanFeature[] = [
    { label: 'Unlimited targets, sessions, notes', free: true, pro: true },
    { label: 'Vulnerability templates and tagging', free: true, pro: true },
    { label: 'Evidence canvas and recon assets', free: true, pro: true },
    { label: 'Hunter toolkit (encoder, JWT, scope validator)', free: true, pro: true },
    { label: 'Stats, streaks, and ROI per program', free: true, pro: true },
    { label: 'Encrypted local backup and restore', free: true, pro: true },
    { label: 'Real-time cloud sync across devices', free: false, pro: true },
    { label: 'End-to-end encrypted evidence storage', free: false, pro: true },
    { label: 'Priority support', free: false, pro: true }
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
      installMessage = 'Use your browser menu to add HuntFlow to your home screen, or run the npm command above.';
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    installMessage =
      choice.outcome === 'accepted'
        ? 'Install started. HuntFlow will be available from your home screen.'
        : 'Install dismissed. You can always run the npm command above instead.';
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
  <title>HuntFlow | The bug bounty workflow OS</title>
  <meta
    name="description"
    content="HuntFlow is a dark, offline-first workspace for bug bounty hunters. Track targets, run timed sessions, write notes, build evidence, ship reports — and sync everything across devices in real time with Pro."
  />
  <meta property="og:title" content="HuntFlow | The bug bounty workflow OS" />
  <meta
    property="og:description"
    content="A dark, offline-first workspace for bug bounty hunters. Targets, timed sessions, evidence canvas, hunter toolkit. Real-time cloud sync with Pro."
  />
  <meta property="og:url" content="https://huntflow.xalgorix.com" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="HuntFlow | The bug bounty workflow OS" />
  <meta
    name="twitter:description"
    content="A dark, offline-first workspace for bug bounty hunters. Real-time cloud sync with Pro."
  />
  <link rel="canonical" href="https://huntflow.xalgorix.com" />
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "HuntFlow",
      "applicationCategory": "ProductivityApplication",
      "operatingSystem": "Web",
      "description": "Offline-first bug bounty workspace for targets, focused sessions, notes, reports, payouts, and real-time cloud sync.",
      "url": "https://huntflow.xalgorix.com",
      "offers": [
        { "@type": "Offer", "name": "Free", "price": "0", "priceCurrency": "USD" },
        { "@type": "Offer", "name": "Pro", "price": "6", "priceCurrency": "USD" }
      ]
    }
  </script>
</svelte:head>

<main class="landing-page min-h-screen overflow-hidden bg-slate-950 text-slate-100">
  <!-- Site header -->
  <header class="sticky top-0 z-30 border-b border-slate-900/80 bg-slate-950/80 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
      <a href="/" class="flex min-h-[44px] items-center gap-2.5 text-slate-100">
        <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white">
          <Crosshair size={18} aria-hidden="true" />
        </span>
        <span class="text-base font-semibold tracking-tight">HuntFlow</span>
      </a>

      <nav class="hidden items-center gap-7 text-sm text-slate-400 md:flex" aria-label="Landing navigation">
        <a class="transition hover:text-slate-100" href="#features">Features</a>
        <a class="transition hover:text-slate-100" href="#cloud-sync">Cloud Sync</a>
        <a class="transition hover:text-slate-100" href="/pricing">Pricing</a>
        <a class="transition hover:text-slate-100" href="#faq">FAQ</a>
      </nav>

      <div class="flex items-center gap-2">
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
          <ArrowRight size={14} aria-hidden="true" />
        </a>
      </div>
    </div>
  </header>

  <!-- Hero -->
  <section class="relative isolate border-b border-slate-800">
    <!-- Background grid + radial accent. Pure CSS, no images. -->
    <div class="absolute inset-0 -z-10" aria-hidden="true">
      <div class="absolute inset-0 bg-slate-950"></div>
      <div
        class="absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(ellipse_at_top,_rgba(20,184,166,0.18),_transparent_55%)]"
      ></div>
      <div
        class="absolute inset-0 opacity-[0.18]"
        style="background-image: linear-gradient(to right, rgb(30 41 59 / 0.5) 1px, transparent 1px), linear-gradient(to bottom, rgb(30 41 59 / 0.5) 1px, transparent 1px); background-size: 56px 56px; mask-image: radial-gradient(ellipse at center top, black 0%, transparent 70%);"
      ></div>
    </div>

    <div class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
      <div class="mx-auto max-w-3xl text-center">
        <div class="inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-slate-900/80 px-3 py-1 text-xs font-medium text-primary-200">
          <WifiOff size={13} aria-hidden="true" />
          Offline-first PWA · npm-installable · open core
        </div>

        <h1 class="mt-6 text-balance text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
          The bug bounty
          <span class="bg-gradient-to-br from-primary-200 via-primary-400 to-cyan-500 bg-clip-text text-transparent">
            workflow OS.
          </span>
        </h1>

        <p class="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-slate-300 sm:text-lg">
          Track targets, run focused sessions, write reproducible notes, build visual evidence, and ship reports —
          all in a single dark workspace that works offline and syncs in real time across every device with Pro.
        </p>

        <div class="mx-auto mt-8 max-w-xl">
          <InstallCommand />
        </div>

        <div class="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="/demo"
            class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <LayoutDashboard size={16} aria-hidden="true" />
            Try the live demo
          </a>
          <a
            href="/dashboard"
            class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
          >
            Open empty workspace
          </a>
          <button
            type="button"
            class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-slate-800 bg-slate-950 px-6 py-3 text-sm font-medium text-slate-300 transition hover:border-slate-700 hover:text-slate-100"
            on:click={installApp}
          >
            Install as PWA
          </button>
        </div>
        {#if installMessage}
          <p class="mt-3 text-sm text-slate-400" aria-live="polite">{installMessage}</p>
        {/if}
      </div>

      <!-- Screenshot showcase right under the hero CTA -->
      <div class="mt-16 sm:mt-20">
        <ScreenshotShowcase />
      </div>
    </div>
  </section>

  <!-- Feature grid -->
  <FeatureGrid />

  <!-- 3-step loop -->
  <section class="border-b border-slate-800 bg-slate-900 px-4 py-20 sm:px-6 lg:px-8">
    <div class="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
      <div>
        <p class="hf-eyebrow">How it works</p>
        <h2 class="mt-2 text-3xl font-bold leading-tight text-slate-100 sm:text-4xl">A three-step loop that turns hours into reports.</h2>
        <p class="mt-3 text-sm leading-6 text-slate-400">
          Every screen in HuntFlow exists to make this loop tighter. No project management overhead, no ceremony — just
          flow.
        </p>
      </div>
      <ol class="grid gap-3">
        {#each steps as step, index}
          <li class="grid gap-4 rounded-xl border border-slate-800 bg-slate-950 p-5 sm:grid-cols-[56px_1fr]">
            <div class="flex h-12 w-12 items-center justify-center rounded-lg border border-primary-500/30 bg-slate-900 font-mono text-base font-bold text-primary-300">
              0{index + 1}
            </div>
            <div>
              <h3 class="text-lg font-semibold text-slate-100">{step.title}</h3>
              <p class="mt-1.5 text-sm leading-6 text-slate-400">{step.description}</p>
            </div>
          </li>
        {/each}
      </ol>
    </div>
  </section>

  <!-- Pro spotlight -->
  <ProSpotlight />

  <!-- Pricing -->
  <section id="pricing" class="border-b border-slate-800 bg-slate-950 px-4 py-20 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-6xl">
      <div class="mx-auto max-w-2xl text-center">
        <p class="hf-eyebrow">Pricing</p>
        <h2 class="mt-2 text-3xl font-bold leading-tight text-slate-100 sm:text-4xl">
          Free forever for the core. Pro when you need sync.
        </h2>
        <p class="mt-3 text-base leading-7 text-slate-400">
          The free plan is genuinely useful day one. Pro unlocks real-time cloud sync, encrypted backups, and a few
          power-user extras.
        </p>
      </div>

      <div class="mt-12 grid gap-5 lg:grid-cols-2">
        <article class="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-dark-sm">
          <div class="flex items-baseline justify-between gap-3">
            <div>
              <h3 class="text-2xl font-bold text-slate-100">Free</h3>
              <p class="mt-1 text-sm text-slate-400">Forever. No card, no account.</p>
            </div>
            <p class="text-4xl font-bold text-white">$0</p>
          </div>

          <ul class="mt-7 flex-1 space-y-3">
            {#each planFeatures as item}
              <li class="flex items-start gap-3 text-sm {item.free ? 'text-slate-200' : 'text-slate-600'}">
                {#if item.free}
                  <Check class="mt-0.5 shrink-0 text-primary-400" size={16} aria-hidden="true" />
                {:else}
                  <XIcon class="mt-0.5 shrink-0 text-slate-700" size={16} aria-hidden="true" />
                {/if}
                <span>{item.label}</span>
              </li>
            {/each}
          </ul>

          <a
            href="/dashboard"
            class="mt-7 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-700"
          >
            Start hunting free
          </a>
        </article>

        <article class="relative flex flex-col rounded-2xl border border-primary-500/40 bg-gradient-to-br from-slate-900 to-slate-900/40 p-6 shadow-dark-md ring-1 ring-primary-500/20">
          <span class="absolute -top-3 right-6 inline-flex items-center gap-1 rounded-full bg-primary-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-950">
            <Sparkles size={11} aria-hidden="true" />
            Most loved
          </span>

          <div class="flex items-baseline justify-between gap-3">
            <div>
              <h3 class="text-2xl font-bold text-slate-100">Pro</h3>
              <p class="mt-1 text-sm text-slate-400">For hunters who work across devices.</p>
            </div>
            <div class="text-right">
              <p class="text-4xl font-bold text-white">$6<span class="text-base font-medium text-slate-400">/mo</span></p>
              <p class="text-xs text-slate-500">or $60/year</p>
            </div>
          </div>

          <ul class="mt-7 flex-1 space-y-3 text-sm text-slate-200">
            {#each planFeatures as item}
              <li class="flex items-start gap-3">
                <Check class="mt-0.5 shrink-0 text-primary-400" size={16} aria-hidden="true" />
                <span>{item.label}</span>
              </li>
            {/each}
          </ul>

          <a
            href="/pricing"
            class="mt-7 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-500"
          >
            Upgrade to Pro
            <ArrowRight size={14} aria-hidden="true" />
          </a>
        </article>
      </div>
    </div>
  </section>

  <!-- FAQ -->
  <FaqSection />

  <!-- Closing CTA -->
  <section class="border-b border-slate-800 bg-slate-900 px-4 py-20 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-3xl text-center">
      <h2 class="text-3xl font-bold leading-tight text-slate-100 sm:text-4xl">Stop juggling tabs. Start a hunt.</h2>
      <p class="mt-3 text-base leading-7 text-slate-400">
        Install in one command. No login required to start.
      </p>
      <div class="mx-auto mt-6 max-w-xl">
        <InstallCommand />
      </div>
      <div class="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <a
          href="/dashboard"
          class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-primary-500"
        >
          Open the app
        </a>
        <a
          href="/sign-up"
          class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-6 py-3 text-sm font-medium text-slate-100 transition hover:bg-slate-700"
        >
          Create an account
        </a>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
    <div class="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
      <div class="max-w-md">
        <div class="flex items-center gap-2.5 text-slate-100">
          <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white">
            <Crosshair size={18} aria-hidden="true" />
          </span>
          <span class="font-semibold">HuntFlow</span>
        </div>
        <p class="mt-3 text-sm leading-6 text-slate-500">
          The bug bounty workflow OS. Built by hunters, for hunters. Open core, offline-first.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-x-12 gap-y-3 text-sm sm:grid-cols-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Product</p>
          <a class="mt-3 block text-slate-300 hover:text-slate-100" href="#features">Features</a>
          <a class="mt-2 block text-slate-300 hover:text-slate-100" href="/pricing">Pricing</a>
          <a class="mt-2 block text-slate-300 hover:text-slate-100" href="#cloud-sync">Cloud sync</a>
          <a class="mt-2 block text-slate-300 hover:text-slate-100" href="/dashboard">Open app</a>
        </div>
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Account</p>
          <a class="mt-3 block text-slate-300 hover:text-slate-100" href="/sign-in">Sign in</a>
          <a class="mt-2 block text-slate-300 hover:text-slate-100" href="/sign-up">Sign up</a>
          <a class="mt-2 block text-slate-300 hover:text-slate-100" href="#faq">FAQ</a>
        </div>
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Connect</p>
          <a
            class="mt-3 inline-flex items-center gap-2 text-slate-300 hover:text-slate-100"
            href="https://github.com/xalgord/huntflow"
            rel="noreferrer"
          >
            <Github size={14} aria-hidden="true" />
            GitHub
          </a>
          <a
            class="mt-2 inline-flex items-center gap-2 text-slate-300 hover:text-slate-100"
            href="https://x.com/xalgord"
            rel="noreferrer"
          >
            <Twitter size={14} aria-hidden="true" />
            Twitter
          </a>
        </div>
      </div>
    </div>

    <div class="mx-auto mt-10 max-w-6xl border-t border-slate-900 pt-6 text-xs text-slate-600">
      &copy; 2026 HuntFlow. All rights reserved.
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
</style>
