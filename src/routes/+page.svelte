<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { clerkAuthStore, initClerk } from '$lib/cloud/clerk';
  import UserMenu from '$lib/components/auth/UserMenu.svelte';
  import ContactSection from '$lib/components/landing/ContactSection.svelte';
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

  /**
   * The landing page doubles as Clerk's post-email-verification landing
   * pad. When a user clicks the verification link in their signup
   * email, Clerk's hosted Frontend API processes the verification and
   * redirects to the application origin (`/`) with a handshake query
   * param like `__clerk_handshake=...`. The embedded mount's
   * `forceRedirectUrl: '/dashboard'` does NOT apply to that hosted
   * flow — only to in-app OTP verification — so without explicit
   * handling here the user lands on the marketing landing while
   * already signed in.
   *
   * We treat any of these as "Clerk is finishing an auth flow":
   *   - `__clerk_handshake`         → email-link verification
   *   - `__clerk_status=verified`   → legacy verified flag
   *   - `__clerk_db_jwt`            → cross-subdomain handshake
   *   - `__clerk_ticket` / `__clerk_invitation_token` → invitation flows
   *
   * When any are present, we render a redirect-pending screen instead
   * of the marketing chrome and bounce to /dashboard the moment Clerk
   * reports a session.
   */
  let redirecting = false;
  let pendingHandshake = false;

  function hasClerkHandshakeParam(url: URL): boolean {
    const keys = [
      '__clerk_handshake',
      '__clerk_status',
      '__clerk_db_jwt',
      '__clerk_ticket',
      '__clerk_invitation_token',
      '__clerk_created_session'
    ];
    for (const key of keys) {
      if (url.searchParams.has(key)) return true;
    }
    return false;
  }

  /**
   * Redirect to /dashboard once. Use SvelteKit's `goto` first (keeps
   * the SPA history clean) and fall back to `window.location.replace`
   * if `goto` fails or hasn't navigated within a few hundred ms. The
   * fallback exists because we've seen rare cases where SvelteKit's
   * router silently no-ops when the URL has lingering Clerk handshake
   * params; a hard replace is a guaranteed escape hatch.
   */
  async function redirectToDashboard(): Promise<void> {
    if (redirecting) return;
    redirecting = true;
    try {
      await goto('/dashboard', { replaceState: true });
    } catch {
      /* fall through to window.location below */
    }
    if (browser && window.location.pathname === '/') {
      window.location.replace('/dashboard');
    }
  }

  onMount(() => {
    if (!browser) return;

    isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

    // PWA-installed users should never see the marketing landing — when
    // they tap the home-screen icon they expect the app, not the pitch.
    // Send them straight to the workspace; the layout's auth gate will
    // bounce to /sign-in if they're not authenticated.
    if (isStandalone) {
      void redirectToDashboard();
      return;
    }

    // Detect a Clerk auth handshake in the URL. If present, we're going
    // to redirect to /dashboard regardless — render a placeholder
    // instead of the marketing hero so users coming back from email
    // verification see "Signing you in…" rather than a flash of the
    // pricing pitch they already converted on.
    pendingHandshake = hasClerkHandshakeParam($page.url);

    // Kick off Clerk so `clerkAuthStore` resolves; the reactive block
    // below will redirect signed-in visitors to /dashboard once it
    // reports a session. Without this call the landing page never
    // initializes Clerk, leaving signed-in users stuck on marketing.
    void initClerk();

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  });

  // Auto-redirect already-signed-in visitors away from the public
  // landing. We wait for `loading` to flip to false so we don't bounce
  // anonymous users (who haven't been confirmed-anonymous yet) into a
  // redirect loop. Configured-but-not-signed-in stays on the landing.
  $: if (
    browser &&
    $clerkAuthStore.configured &&
    !$clerkAuthStore.loading &&
    $clerkAuthStore.signedIn
  ) {
    void redirectToDashboard();
  }

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

{#if pendingHandshake || redirecting || ($clerkAuthStore.configured && !$clerkAuthStore.loading && $clerkAuthStore.signedIn)}
  <!--
    Auth-handshake placeholder. Rendered instead of the full marketing
    landing while we're (a) processing a Clerk verification handshake
    coming back from the email link, (b) actively redirecting an
    already-signed-in visitor, or (c) about to redirect because Clerk
    just resolved a session. Showing this for the brief moment between
    "Clerk reports session" and "router lands on /dashboard" prevents
    the marketing pitch from flashing in front of users who already
    converted.
  -->
  <main
    class="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-4 text-center text-slate-300"
    aria-busy="true"
    aria-live="polite"
  >
    <span
      class="flex h-12 w-12 items-center justify-center rounded-xl border border-primary-500/30 bg-primary-500/10 text-primary-400"
    >
      <Crosshair size={22} aria-hidden="true" />
    </span>
    <p class="text-sm font-medium text-slate-200">Signing you in&hellip;</p>
    <p class="max-w-xs text-xs text-slate-500">
      One second &mdash; HuntFlow is finishing your sign-in and opening your workspace.
    </p>
  </main>
{:else}
<main class="landing-page min-h-screen overflow-hidden bg-slate-950 text-slate-100">
  <!-- Site header -->
  <header class="sticky top-0 z-30 border-b border-slate-900/80 bg-slate-950/80 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
      <a href="/" class="flex min-h-[44px] items-center gap-2.5 text-slate-100">
        <!--
          Premium marketing-page brand mark. We use the generated JPG
          (instead of the inline BrandMark SVG) because it carries the
          subtle cyan-on-emerald lock-on highlight that renders better
          as raster than as flat SVG. Internal surfaces (SideNav,
          MobileHeader, favicon, PWA icon) still use the SVG mark so
          they stay crisp at every size and themable for tinted tiles.
        -->
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

      <nav class="hidden items-center gap-7 text-sm text-slate-400 md:flex" aria-label="Landing navigation">
        <a class="transition hover:text-slate-100" href="#features">Features</a>
        <a class="transition hover:text-slate-100" href="#cloud-sync">Cloud Sync</a>
        <a class="transition hover:text-slate-100" href="/pricing">Pricing</a>
        <a class="transition hover:text-slate-100" href="#faq">FAQ</a>
        <a class="transition hover:text-slate-100" href="#contact">Contact</a>
      </nav>

      <div class="flex items-center gap-2">
        {#if $clerkAuthStore.configured && $clerkAuthStore.loading}
          <!--
            Clerk-is-still-loading skeleton. Without this branch we'd
            render Sign-in / Get-started for the 0.5–2s window between
            page hydration and Clerk reporting a session, so a user who
            JUST signed up and was redirected back to `/` would see
            "Sign in / Get started" buttons even though they're
            already authenticated. Reserving the slot with a quiet
            placeholder keeps the header stable and prevents that
            wrong-state flash.
          -->
          <span
            class="inline-flex min-h-[36px] items-center gap-2 rounded-md px-3 py-1.5 text-sm text-slate-500"
            aria-live="polite"
          >
            <span
              class="h-2 w-2 animate-pulse rounded-full bg-primary-500"
              aria-hidden="true"
            ></span>
            Checking session&hellip;
          </span>
        {:else if $clerkAuthStore.signedIn}
          <!--
            Signed-in visitors get a "Open app" shortcut + the Clerk
            profile menu instead of marketing CTAs they no longer need.
            This block is rarely seen for long because the reactive
            redirect above sends them to /dashboard, but it stays in
            place during the brief window between Clerk resolving and
            navigation completing — and during demo-mode visits where
            the landing is intentionally re-displayed.
          -->
          <a
            href="/dashboard"
            class="hidden min-h-[36px] items-center justify-center gap-1.5 rounded-md bg-primary-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-500 sm:inline-flex"
          >
            Open app
            <ArrowRight size={14} aria-hidden="true" />
          </a>
          <UserMenu />
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
            <ArrowRight size={14} aria-hidden="true" />
          </a>
        {/if}
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

  <!-- Contact form (Resend-powered) -->
  <ContactSection />

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
{/if}

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
