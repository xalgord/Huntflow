<script lang="ts">
  import BrandMark from '$lib/components/brand/BrandMark.svelte';
  import ScreenshotShowcase from '$lib/components/landing/ScreenshotShowcase.svelte';
  import FeatureGrid from '$lib/components/landing/FeatureGrid.svelte';
  import ProSpotlight from '$lib/components/landing/ProSpotlight.svelte';
  import FaqSection from '$lib/components/landing/FaqSection.svelte';
  import InstallCommand from '$lib/components/landing/InstallCommand.svelte';
  import { ArrowRight, Github, Lock, Terminal, Twitter } from 'lucide-svelte';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'HuntFlow',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Web, Windows, macOS, Linux',
    description:
      'Local-first pentest command center for tracking engagements, targets, test sessions, evidence, report drafts, and findings.',
    url: 'https://huntflow.xalgorix.com',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD'
    },
    publisher: {
      '@type': 'Organization',
      name: 'xalgorix',
      url: 'https://huntflow.xalgorix.com'
    }
  };
  const jsonLdScript = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
</script>

<svelte:head>
  <title>HuntFlow — Local-First Pentest Workflow App</title>
  <meta
    name="description"
    content="HuntFlow is a local-first pentest command center for tracking engagements, targets, test sessions, evidence, report drafts, and findings."
  />
  <link rel="canonical" href="https://huntflow.xalgorix.com/" />
  <meta name="robots" content="index,follow" />
  <meta property="og:title" content="HuntFlow — Local-First Pentest Workflow App" />
  <meta
    property="og:description"
    content="Track engagements, targets, test sessions, evidence, report drafts, and findings without spreadsheets or cloud lock-in."
  />
  <meta property="og:image" content="https://huntflow.xalgorix.com/brand/huntflow-mark.jpg" />
  <meta property="og:image:width" content="1024" />
  <meta property="og:image:height" content="1024" />
  <meta property="og:image:alt" content="HuntFlow brand mark — three stacked chevron-cut slabs" />
  <meta property="og:url" content="https://huntflow.xalgorix.com/" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="en_US" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="HuntFlow — Local-First Pentest Workflow App" />
  <meta
    name="twitter:description"
    content="A local-first command center for authorized security testing and pentest engagements."
  />
  <meta name="twitter:image" content="https://huntflow.xalgorix.com/brand/huntflow-mark.jpg" />
  <meta name="twitter:image:alt" content="HuntFlow brand mark" />
  <meta name="twitter:site" content="@xalgorix" />
  <meta name="twitter:creator" content="@xalgorix" />
  {@html `<script type="application/ld+json">${jsonLdScript}</script>`}
</svelte:head>

<main class="min-h-screen bg-black text-zinc-50">
  <header class="sticky top-0 z-50 border-b border-zinc-900 bg-black/80 backdrop-blur-xl">
    <nav class="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5">
      <a href="/" class="flex items-center gap-3 transition hover:opacity-80">
        <BrandMark size={30} />
        <span>
          <span class="block text-sm font-semibold">HuntFlow</span>
          <span class="block text-[11px] text-zinc-500">pentest command center</span>
        </span>
      </a>
      <nav class="hidden items-center gap-7 text-sm text-zinc-400 md:flex" aria-label="Main nav">
        <a class="transition hover:text-zinc-100" href="/#features">Features</a>
        <a class="transition hover:text-zinc-100" href="/#cloud-sync">Cloud Sync</a>
        <a class="transition hover:text-zinc-100" href="/#faq">FAQ</a>
        <a class="transition hover:text-zinc-100" href="/pricing">Pricing</a>
      </nav>
      <div class="flex items-center gap-2">
        <a
          href="https://github.com/xalgord"
          class="hf-button-ghost hidden sm:inline-flex"
          target="_blank"
          rel="noreferrer"
        >
          <Github size={16} aria-hidden="true" />
          GitHub
        </a>
        <a href="/dashboard" class="hf-button-primary min-h-[40px]">Start using</a>
      </div>
    </nav>
  </header>

  <section class="relative overflow-hidden border-b border-zinc-900 bg-black">
    <div class="mx-auto flex min-h-[calc(100vh-64px)] max-w-7xl flex-col justify-between px-5 py-14 sm:py-16">
      <div class="mx-auto max-w-5xl text-center">
        <p class="text-sm font-medium text-zinc-400">HuntFlow by xalgorix</p>
        <h1
          class="mx-auto mt-4 max-w-5xl text-5xl font-semibold leading-tight tracking-normal text-white sm:text-6xl lg:text-7xl"
        >
          Your local-first command center for penetration testing.
        </h1>
        <p class="mx-auto mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
          Track engagements, targets, test sessions, evidence, report drafts, and findings
          without spreadsheets or cloud lock-in.
        </p>
        <div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a href="/dashboard" class="hf-button-primary">
            Start using
            <ArrowRight size={16} aria-hidden="true" />
          </a>
          <a
            href="https://github.com/xalgord"
            target="_blank"
            rel="noreferrer"
            class="hf-button-secondary"
          >
            <Github size={16} aria-hidden="true" />
            View GitHub
          </a>
        </div>
        <div
          class="mx-auto mt-6 flex max-w-md flex-col gap-2"
        >
          <p class="text-center text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-600">
            Install
          </p>
          <InstallCommand />
        </div>
      </div>

      <div class="mt-12">
        <ScreenshotShowcase />
      </div>
    </div>
  </section>

  <FeatureGrid />

  <section
    class="mx-auto grid max-w-7xl gap-4 px-5 py-16 md:grid-cols-3"
  >
    <article class="hf-card p-5">
      <Lock class="text-zinc-400" size={22} aria-hidden="true" />
      <h2 class="mt-4 text-lg font-semibold text-zinc-100">Private by default</h2>
      <p class="mt-2 text-sm leading-6 text-zinc-500">
        No login required for local use, no telemetry. Optional hosted account features stay
        isolated from your local workspace.
      </p>
    </article>
    <article class="hf-card p-5">
      <Terminal class="text-zinc-400" size={22} aria-hidden="true" />
      <h2 class="mt-4 text-lg font-semibold text-zinc-100">Runs from your terminal</h2>
      <p class="mt-2 text-sm leading-6 text-zinc-500">
        Install via npm and serve the app on localhost. Works fully air-gapped — cloud sync just
        stays disabled.
      </p>
    </article>
    <article class="hf-card p-5">
      <Github class="text-zinc-400" size={22} aria-hidden="true" />
      <h2 class="mt-4 text-lg font-semibold text-zinc-100">Open core</h2>
      <p class="mt-2 text-sm leading-6 text-zinc-500">
        Built by pentesters, for pentesters. The local-first core is free; Pro adds cloud sync and
        encrypted backups.
      </p>
    </article>
  </section>

  <ProSpotlight />

  <FaqSection />

  <section class="mx-auto max-w-7xl px-5 py-16">
    <div class="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      <div>
        <p class="hf-eyebrow">Quickstart</p>
        <h2 class="mt-3 text-3xl font-semibold text-zinc-50">Run it locally.</h2>
        <p class="mt-4 text-sm leading-7 text-zinc-500">
          HuntFlow ships as a local app. Start from npm, then export or back up your workspace from
          Settings.
        </p>
      </div>
      <div class="max-w-md">
        <InstallCommand />
      </div>
    </div>
  </section>

  <section class="border-t border-zinc-900 px-5 py-12">
    <div class="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-2xl font-semibold text-zinc-50">Start testing with a cleaner workspace.</h2>
        <p class="mt-2 text-sm text-zinc-500">
          Local-first pentest workflow management by xalgorix.
        </p>
      </div>
      <a href="/dashboard" class="hf-button-primary">
        Start using
        <ArrowRight size={16} aria-hidden="true" />
      </a>
    </div>
  </section>

  <footer class="border-t border-zinc-900 px-5 py-12">
    <div
      class="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-start md:justify-between"
    >
      <div class="max-w-md">
        <div class="flex items-center gap-2.5 text-zinc-100">
          <BrandMark size={32} />
          <span class="font-semibold">HuntFlow</span>
        </div>
        <p class="mt-3 text-sm leading-6 text-zinc-500">
          The pentest workflow OS. Built by pentesters, for pentesters. Open core, offline-first.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-x-12 gap-y-3 text-sm sm:grid-cols-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Product</p>
          <a class="mt-3 block text-zinc-300 transition hover:text-zinc-100" href="/#features"
            >Features</a
          >
          <a class="mt-2 block text-zinc-300 transition hover:text-zinc-100" href="/pricing"
            >Pricing</a
          >
          <a class="mt-2 block text-zinc-300 transition hover:text-zinc-100" href="/#cloud-sync"
            >Cloud sync</a
          >
          <a class="mt-2 block text-zinc-300 transition hover:text-zinc-100" href="/dashboard"
            >Open app</a
          >
        </div>
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Account</p>
          <a class="mt-3 block text-zinc-300 transition hover:text-zinc-100" href="/sign-in"
            >Sign in</a
          >
          <a class="mt-2 block text-zinc-300 transition hover:text-zinc-100" href="/sign-up"
            >Sign up</a
          >
          <a class="mt-2 block text-zinc-300 transition hover:text-zinc-100" href="/#faq">FAQ</a>
        </div>
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Connect</p>
          <a
            class="mt-3 inline-flex items-center gap-2 text-zinc-300 transition hover:text-zinc-100"
            href="https://github.com/xalgord/huntflow"
            rel="noreferrer"
          >
            <Github size={14} aria-hidden="true" />
            GitHub
          </a>
          <a
            class="mt-2 inline-flex items-center gap-2 text-zinc-300 transition hover:text-zinc-100"
            href="https://x.com/xalgorix"
            rel="noreferrer"
          >
            <Twitter size={14} aria-hidden="true" />
            Twitter
          </a>
        </div>
      </div>
    </div>

    <div class="mx-auto mt-10 max-w-7xl border-t border-zinc-900 pt-6 text-xs text-zinc-600">
      &copy; 2026 HuntFlow by xalgorix. MIT Licensed.
    </div>
  </footer>
</main>
