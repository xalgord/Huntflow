<script lang="ts">
  /**
   * `/account` — the canonical user account hub.
   *
   * The auth gate in `+layout.svelte` already guarantees a Clerk
   * session before this page mounts, so we can render the hero and
   * subscription panel synchronously from the auth store. The full
   * profile widget (profile fields, security, sessions, connected
   * accounts, 2FA, billing tab) is embedded via `mountClerkUserProfile`
   * — this is the same widget that powers Clerk's dashboard, themed
   * to slot into HuntFlow's slate-950 chrome.
   *
   * Why `/account` and `/settings` are separate:
   *   - `/account`  → identity, security, subscription. Owned by Clerk.
   *   - `/settings` → app preferences (timer, theme, backup, data).
   *
   * They cross-link at the top so users can jump between them, but
   * keeping them separate avoids cramming a 600-line settings page
   * into the same scroll context.
   */
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { IS_APP, IS_WEB } from '$lib/buildTarget';
  import {
    clerkAuthStore,
    initClerk,
    mountClerkUserProfile,
    openClerkSubscriptions,
    signInWithClerk,
    signOutFromClerk
  } from '$lib/cloud/clerk';
  import {
    ArrowRight,
    BadgeCheck,
    CheckCircle2,
    Cloud,
    CreditCard,
    Database,
    ExternalLink,
    HardDrive,
    LogIn,
    LogOut,
    Mail,
    Settings as SettingsIcon,
    Shield,
    Sparkles,
    UserRound,
    X
  } from 'lucide-svelte';
  import { onDestroy, onMount } from 'svelte';

  let mountNode: HTMLDivElement | null = null;
  let unmountProfile: (() => void) | null = null;
  let profileMounted = false;
  let openingSubscriptions = false;
  let signingOut = false;
  let showProWelcome = false;
  let clerkObserver: MutationObserver | null = null;

  /**
   * Force-patch Clerk's internal DOM elements. Clerk injects CSS-in-JS
   * with extremely high specificity (`cl-internal-*` classes) and even
   * inline styles that no CSS `!important` can reliably override. This
   * observer fires on every subtree mutation and brute-force clears any
   * non-transparent background that sneaks through.
   */
  function patchClerkDom(root: HTMLElement): void {
    const allEls = root.querySelectorAll<HTMLElement>('[class*="cl-"]');
    for (const el of allEls) {
      const cs = getComputedStyle(el);
      const bg = cs.backgroundColor;
      // Skip transparent/inherit
      if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') continue;
      // Parse the RGB values to detect "light" backgrounds
      const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const [, r, g, b] = match.map(Number);
        // If any channel is brighter than our dark theme floor (~30),
        // this element has a light/medium background that needs clearing.
        // Our darkest bg is #0c1222 = rgb(12,18,34). Anything with
        // luminance above ~50 is "too light" for the dark card.
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum > 40) {
          el.style.setProperty('background-color', 'transparent', 'important');
          el.style.setProperty('background', 'transparent', 'important');
        }
      }
    }
    // Force all Clerk container widths to 100%
    const widthTargets = [
      '.cl-rootBox', '.cl-card', '.cl-cardBox',
      '.cl-userProfile-root', '.cl-pageScrollBox',
      '.cl-page', '.cl-scrollBox'
    ];
    for (const sel of widthTargets) {
      const el = root.querySelector<HTMLElement>(sel);
      if (el) {
        el.style.setProperty('width', '100%', 'important');
        el.style.setProperty('max-width', '100%', 'important');
      }
    }
    // Also nuke backgrounds on card/cardBox
    for (const sel of ['.cl-card', '.cl-cardBox']) {
      const el = root.querySelector<HTMLElement>(sel);
      if (el) {
        el.style.setProperty('background', 'transparent', 'important');
        el.style.setProperty('box-shadow', 'none', 'important');
        el.style.setProperty('border', 'none', 'important');
      }
    }
    // Force content areas to flex-grow and fill remaining width
    const flexTargets = ['.cl-pageScrollBox', '.cl-page', '.cl-scrollBox'];
    for (const sel of flexTargets) {
      const el = root.querySelector<HTMLElement>(sel);
      if (el) {
        el.style.setProperty('flex', '1 1 0%', 'important');
        el.style.setProperty('min-width', '0', 'important');
        el.style.setProperty('max-width', '100%', 'important');
        el.style.setProperty('width', '100%', 'important');
      }
    }
    // Nuke any max-width on cl-internal elements that constrain layout
    const internals = root.querySelectorAll<HTMLElement>('[class*="cl-internal"]');
    for (const el of internals) {
      const mw = getComputedStyle(el).maxWidth;
      if (mw && mw !== 'none' && mw !== '100%') {
        el.style.setProperty('max-width', '100%', 'important');
        el.style.setProperty('width', '100%', 'important');
      }
    }
    // Remove partial-width border lines from profileSectionTitle elements
    const sectionTitles = root.querySelectorAll<HTMLElement>('[class*="cl-profileSectionTitle"]');
    for (const el of sectionTitles) {
      el.style.setProperty('border', 'none', 'important');
      el.style.setProperty('border-bottom', 'none', 'important');
      el.style.setProperty('border-top', 'none', 'important');
    }
    // Also remove the header divider line under "Profile details"
    const headerElements = root.querySelectorAll<HTMLElement>('.cl-headerTitle, [class*="cl-header"]');
    for (const el of headerElements) {
      el.style.setProperty('border-bottom', 'none', 'important');
      // Check parent for border too
      const parent = el.parentElement;
      if (parent && parent.closest('#hf-clerk-mount')) {
        parent.style.setProperty('border-bottom', 'none', 'important');
      }
    }
    // Hide the API keys nav button — belt-and-suspenders with apiKeysProps
    const apiKeysBtn = root.querySelector<HTMLElement>(
      '.cl-navbarButton__apiKeys, [class*="navbarButton__apiKeys"]'
    );
    if (apiKeysBtn) {
      apiKeysBtn.style.setProperty('display', 'none', 'important');
    }
  }

  function startClerkObserver(root: HTMLElement): void {
    // Initial patch
    patchClerkDom(root);
    // Observe all future mutations
    clerkObserver = new MutationObserver(() => patchClerkDom(root));
    clerkObserver.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  }

  onMount(async () => {
    if (!browser) return;

    // Local-mode short-circuit. With no Clerk publishable key the app
    // is running as a private offline install — there's no Clerk
    // session to mount a UserProfile against. The app build also lands
    // here in `localView` mode for signed-out users (they see a
    // "Connect cloud sync" CTA instead of an identity widget).
    if (!$clerkAuthStore.configured) return;
    if (!$clerkAuthStore.signedIn) return;

    // Detect ?welcome=pro injected by the pricing page after a successful
    // subscription checkout. Show a one-time success banner and clean the
    // param from the URL so it doesn't reappear on refresh or share.
    if ($page.url.searchParams.get('welcome') === 'pro') {
      showProWelcome = true;
      const cleanUrl = new URL($page.url.toString());
      cleanUrl.searchParams.delete('welcome');
      history.replaceState(history.state, '', cleanUrl.toString());
    }
    // Make sure Clerk is initialized — if the user lands here directly
    // via deep link the layout's `initClerk()` call may still be in
    // flight, so we await it explicitly before mounting the widget.
    await initClerk();
    if (!mountNode) return;
    // Mount Clerk's full UserProfile widget. It manages its own
    // internal navigation between tabs (Profile / Security / Sessions /
    // Connected Accounts / Billing) — we don't need to pass a routing
    // strategy; the default keeps tab state inside the widget.
    unmountProfile = await mountClerkUserProfile(mountNode, {});
    profileMounted = true;
    // Start the DOM observer to force-patch Clerk's CSS-in-JS styles
    startClerkObserver(mountNode);
  });

  onDestroy(() => {
    clerkObserver?.disconnect();
    unmountProfile?.();
  });

  async function handleManageSubscription(): Promise<void> {
    openingSubscriptions = true;
    try {
      const opened = await openClerkSubscriptions();
      // If Clerk doesn't expose a subscriptions modal on this instance,
      // bounce to a pricing surface where the user can change plans.
      // Web: internal /pricing route. App: hosted huntflow.xalgorix.com/pricing
      // (the local /pricing route doesn't exist in the app build).
      if (!opened) {
        if (IS_WEB) {
          await goto('/pricing');
        } else if (browser) {
          window.open('https://huntflow.xalgorix.com/pricing', '_blank', 'noopener,noreferrer');
        }
      }
    } finally {
      openingSubscriptions = false;
    }
  }

  async function handleSignOut(): Promise<void> {
    if (signingOut) return;
    signingOut = true;
    try {
      await signOutFromClerk();
    } finally {
      signingOut = false;
    }
  }

  /**
   * Build a 2-letter avatar fallback from the display name. Used when
   * Clerk hasn't resolved an `imageUrl` yet (fresh signup, slow CDN).
   * "Alice Hunter" → "AH", "alice" → "AL", empty → "HF".
   */
  function avatarInitials(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return 'HF';
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  }

  $: displayName = $clerkAuthStore.displayName || 'Local hunter';
  $: email = $clerkAuthStore.email;
  $: imageUrl = $clerkAuthStore.imageUrl;
  $: isPro = $clerkAuthStore.isPro;
  $: initials = avatarInitials(displayName);

  // The account page has three logical modes:
  //
  //   1. `localView` — render a local-workspace summary with no Clerk
  //      identity. Triggered when Clerk isn't configured at all (legacy
  //      self-hosted) OR when we're in the app build and the user isn't
  //      signed in. The app build always has a publishable key, so
  //      "signed-out" is the normal state for users who haven't opted
  //      into cloud sync — they should still see a meaningful page.
  //
  //   2. `signedInView` — render the Clerk identity hero, subscription
  //      panel, and embedded UserProfile widget. Fires whenever Clerk
  //      reports a session.
  //
  //   3. `guestView` — web build, Clerk configured, but user isn't
  //      signed in. Shows a sign-in / sign-up CTA instead of the
  //      "Loading profile…" spinner.
  $: localView = !$clerkAuthStore.configured || (IS_APP && !$clerkAuthStore.signedIn);
  $: guestView = !localView && $clerkAuthStore.configured && !$clerkAuthStore.signedIn;
</script>

<svelte:head>
  <title>{$clerkAuthStore.configured ? 'Account' : 'Local workspace'} &middot; HuntFlow</title>
  <meta
    name="description"
    content={$clerkAuthStore.configured
      ? 'Manage your HuntFlow profile, security, sessions, and subscription.'
      : 'You\u2019re running HuntFlow privately on this device.'}
  />
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner max-w-5xl">
    {#if guestView}
      <!-- Guest view: web user not signed in. Show sign-in/signup CTA. -->
      <header class="hf-page-header">
        <div class="flex items-start gap-3">
          <div class="rounded-lg border border-primary/25 bg-primary/10 p-2 text-primary shadow-inner-line">
            <UserRound size={28} aria-hidden="true" />
          </div>
          <div class="min-w-0">
            <p class="hf-eyebrow">Identity &amp; subscription</p>
            <h1 class="hf-title">Account</h1>
            <p class="hf-description">
              Sign in to manage your profile, security, sessions, and HuntFlow Pro subscription.
            </p>
          </div>
        </div>
      </header>

      <section class="hf-card overflow-hidden p-0">
        <div class="relative isolate p-6 sm:p-8">
          <div
            class="absolute inset-x-0 top-0 -z-10 h-32 bg-[radial-gradient(ellipse_at_top_left,_hsl(var(--primary)/0.18),_transparent_60%)]"
            aria-hidden="true"
          ></div>

          <div class="flex flex-col items-center gap-6 py-8 text-center">
            <span
              class="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-dark-sm"
              aria-hidden="true"
            >
              <LogIn size={36} />
            </span>

            <div class="max-w-md">
              <h2 class="text-2xl font-bold text-foreground">Sign in to your account</h2>
              <p class="mt-2 text-sm text-muted-foreground">
                Access your profile, manage security settings, view active sessions,
                and control your HuntFlow Pro subscription.
              </p>
            </div>

            <div class="flex flex-col gap-3 sm:flex-row">
              <a
                href="/sign-in"
                class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                <LogIn size={16} aria-hidden="true" />
                Sign in
              </a>
              <a
                href="/sign-up"
                class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-border bg-muted/40 px-6 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Create account
                <ArrowRight size={14} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <!-- Teaser for what's behind the sign-in gate -->
      <section class="hf-card p-4 sm:p-6">
        <div class="flex items-start gap-3">
          <div class="rounded-lg border border-primary/25 bg-primary/10 p-2 text-primary shadow-inner-line">
            <Sparkles size={22} aria-hidden="true" />
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="text-lg font-semibold text-foreground">Why create an account?</h2>
            <ul class="mt-3 space-y-2 text-sm text-muted-foreground">
              <li class="flex items-start gap-2">
                <Cloud size={14} class="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                Real-time cloud sync across every device
              </li>
              <li class="flex items-start gap-2">
                <Shield size={14} class="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                End-to-end encrypted evidence and notes
              </li>
              <li class="flex items-start gap-2">
                <BadgeCheck size={14} class="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                Priority email support with Pro plan
              </li>
              <li class="flex items-start gap-2">
                <CreditCard size={14} class="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                Manage subscription and billing in one place
              </li>
            </ul>
          </div>
        </div>
      </section>
    {:else if localView}
      <!--
        Local-workspace view. Renders for two scenarios:
          (a) Clerk isn't configured at all (legacy self-hosted install).
          (b) App build, user not signed in. Cloud sync is opt-in here
              and a meaningful account page must work without an identity.
        We never reference Clerk's UserProfile widget in this branch.
        In case (b) we surface a real "Connect cloud sync" CTA that
        opens /sign-in; in case (a) the CTA points at huntflow.xalgorix.com.
      -->
      <header class="hf-page-header">
        <div class="flex items-start gap-3">
          <div class="rounded-lg border border-primary/25 bg-primary/10 p-2 text-primary shadow-inner-line">
            <HardDrive size={28} aria-hidden="true" />
          </div>
          <div class="min-w-0">
            <p class="hf-eyebrow">Local installation</p>
            <h1 class="hf-title">Local workspace</h1>
            <p class="hf-description">
              You&apos;re running HuntFlow privately on this device. Everything you create lives in
              <span class="text-foreground">IndexedDB</span> in this browser. App preferences,
              backups, import &amp; reset live in
              <a href="/settings" class="text-primary-300 underline-offset-4 hover:underline">Settings</a>.
            </p>
          </div>
        </div>
      </header>

      <!-- Local profile card. No identity to display, so we lean on a
           generic avatar and surface what *is* meaningful here:
           "your data is on this device only". -->
      <section class="hf-card overflow-hidden p-0">
        <div class="relative isolate p-6 sm:p-8">
          <div
            class="absolute inset-x-0 top-0 -z-10 h-32 bg-[radial-gradient(ellipse_at_top_left,_hsl(var(--primary)/0.18),_transparent_60%)]"
            aria-hidden="true"
          ></div>

          <div class="flex flex-col gap-5 sm:flex-row sm:items-center">
            <span
              class="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-dark-sm"
              aria-hidden="true"
            >
              <UserRound size={36} />
            </span>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="truncate text-2xl font-bold text-foreground">Local hunter</h2>
                <span
                  class="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary"
                >
                  <Database size={12} aria-hidden="true" />
                  Local install
                </span>
              </div>
              <p class="mt-1 text-sm text-muted-foreground">
                Private, offline-first. No sign-in required.
              </p>

              <div class="mt-4 flex flex-wrap gap-2">
                <a
                  href="/settings"
                  class="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  <SettingsIcon size={14} aria-hidden="true" />
                  App settings
                </a>
                <a
                  href="/dashboard"
                  class="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  <ArrowRight size={14} aria-hidden="true" />
                  Open dashboard
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Cloud sync CTA. Two flavors:
             1. App build (Clerk configured, just not signed in): a real
                in-app "Connect cloud sync" button that opens /sign-in.
                Sign-in only enables sync; the local workspace keeps
                working untouched.
             2. Legacy no-Clerk install: a quiet outbound link to the
                hosted huntflow.xalgorix.com, since there's no in-app sign-in
                surface to send the user to. -->
      <section class="hf-card p-4 sm:p-6">
        <div class="flex items-start gap-3">
          <div class="rounded-lg border border-primary/25 bg-primary/10 p-2 text-primary shadow-inner-line">
            <Cloud size={22} aria-hidden="true" />
          </div>
          <div class="min-w-0 flex-1">
            {#if $clerkAuthStore.configured}
              <h2 class="text-lg font-semibold text-foreground">Sync across every device</h2>
              <p class="mt-1 text-sm text-muted-foreground">
                Sign in to enable real-time cloud sync, end-to-end encrypted evidence, and access
                from any device. Your local workspace on this machine keeps working either way.
              </p>
              <div class="mt-4 flex flex-col gap-2 sm:flex-row">
                <a
                  href="/sign-in"
                  class="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                >
                  <Cloud size={14} aria-hidden="true" />
                  Connect cloud sync
                  <ArrowRight size={14} aria-hidden="true" />
                </a>
                <a
                  href="/sign-up"
                  class="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md border border-border bg-muted/40 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  Create account
                </a>
              </div>
            {:else}
              <h2 class="text-lg font-semibold text-foreground">Want it on every device?</h2>
              <p class="mt-1 text-sm text-muted-foreground">
                The hosted version at <span class="font-medium text-foreground">huntflow.xalgorix.com</span>
                adds real-time cloud sync, end-to-end encrypted evidence, and priority support
                &mdash; same app, same data model, plus a sync backbone. Your local install keeps
                working either way.
              </p>
              <div class="mt-4">
                <a
                  href="https://huntflow.xalgorix.com/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex min-h-[40px] items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20"
                >
                  <Sparkles size={14} aria-hidden="true" />
                  Get cloud sync at huntflow.xalgorix.com
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              </div>
            {/if}
          </div>
        </div>
      </section>

      <!-- Local-data section. This is the practical action surface for
           local-mode users: backups, import, reset. We don't duplicate
           the controls here — we just point at /settings, which already
           owns them. -->
      <section class="hf-card p-4 sm:p-6">
        <div class="flex items-start gap-3">
          <div class="rounded-lg border border-border bg-muted/40 p-2 text-muted-foreground">
            <Database size={22} aria-hidden="true" />
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="text-lg font-semibold text-foreground">Your data, on your machine</h2>
            <p class="mt-1 text-sm text-muted-foreground">
              All targets, sessions, notes, evidence, and submissions stay in this browser&apos;s
              IndexedDB. To take a portable encrypted backup, restore one, or wipe and start over,
              open the data section in
              <a href="/settings" class="text-primary-300 underline-offset-4 hover:underline">Settings</a>.
            </p>
            <div class="mt-4">
              <a
                href="/settings"
                class="inline-flex min-h-[40px] items-center gap-1.5 rounded-md border border-border bg-muted/40 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                <SettingsIcon size={14} aria-hidden="true" />
                Open settings
                <ArrowRight size={14} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>
    {:else}
    {#if showProWelcome}
      <!-- One-time Pro upgrade confirmation banner. Dismissed permanently
           once the user closes it — the URL param has already been stripped
           so it won't reappear on reload. -->
      <div
        role="status"
        aria-live="polite"
        class="flex items-start gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm ring-1 ring-primary/20"
      >
        <CheckCircle2
          size={20}
          class="mt-0.5 shrink-0 text-primary"
          aria-hidden="true"
        />
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-foreground">Welcome to HuntFlow Pro</p>
          <p class="mt-0.5 text-muted-foreground">
            Your Pro plan is now active. Real-time cloud sync and end-to-end encrypted evidence
            are live across every signed-in device.
          </p>
        </div>
        <button
          type="button"
          class="ml-2 shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label="Dismiss welcome banner"
          on:click={() => (showProWelcome = false)}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    {/if}

    <header class="hf-page-header">
      <div class="flex items-start gap-3">
        <div class="rounded-lg border border-primary/25 bg-primary/10 p-2 text-primary shadow-inner-line">
          <UserRound size={28} aria-hidden="true" />
        </div>
        <div class="min-w-0">
          <p class="hf-eyebrow">Identity &amp; subscription</p>
          <h1 class="hf-title">Account</h1>
          <p class="hf-description">
            Manage your profile, password, connected accounts, active sessions, and HuntFlow Pro
            subscription. App-level preferences (timer, theme, backups) live in
            <a href="/settings" class="text-primary-300 underline-offset-4 hover:underline">Settings</a>.
          </p>
        </div>
      </div>
    </header>

    <!-- Identity hero — avatar, name, email, plan badge.
         Renders synchronously from the auth store so the page never
         shows a skeleton flash before the embedded Clerk widget loads. -->
    <section class="hf-card overflow-hidden p-0">
      <div class="relative isolate p-6 sm:p-8">
        <div
          class="absolute inset-x-0 top-0 -z-10 h-32 bg-[radial-gradient(ellipse_at_top_left,_hsl(var(--primary)/0.18),_transparent_60%)]"
          aria-hidden="true"
        ></div>

        <div class="flex flex-col gap-5 sm:flex-row sm:items-center">
          <!-- Avatar: real Clerk image preferred, two-letter fallback otherwise.
               crossorigin=anonymous lets the browser cache cross-origin
               Clerk images without re-downloading on each render. -->
          {#if imageUrl}
            <img
              src={imageUrl}
              alt={displayName}
              width="80"
              height="80"
              class="h-20 w-20 shrink-0 rounded-2xl border border-border/70 bg-muted object-cover shadow-dark-sm"
              referrerpolicy="no-referrer"
              loading="eager"
              decoding="async"
            />
          {:else}
            <span
              class="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-2xl font-semibold tracking-wide text-primary shadow-dark-sm"
              aria-hidden="true"
            >
              {initials}
            </span>
          {/if}

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="truncate text-2xl font-bold text-foreground">{displayName}</h2>
              {#if isPro}
                <span
                  class="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary"
                >
                  <BadgeCheck size={12} aria-hidden="true" />
                  Pro
                </span>
              {:else}
                <span
                  class="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Free
                </span>
              {/if}
            </div>
            {#if email}
              <p class="mt-1 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                <Mail size={14} aria-hidden="true" />
                <span class="truncate">{email}</span>
              </p>
            {/if}

            <div class="mt-4 flex flex-wrap gap-2">
              <a
                href="/settings"
                class="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                <SettingsIcon size={14} aria-hidden="true" />
                App settings
              </a>
              <button
                type="button"
                class="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-red-300 transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60"
                on:click={handleSignOut}
                disabled={signingOut}
              >
                <LogOut size={14} aria-hidden="true" />
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Subscription panel. The CTA depends on plan:
         · Free → "Upgrade to Pro" → /pricing
         · Pro  → "Manage subscription" → Clerk billing modal (or /pricing fallback)
         The static plan summary below keeps the value prop visible
         even while the (async) Clerk widget is still mounting. -->
    <section class="hf-card p-4 sm:p-6">
      <div class="flex items-start gap-3">
        <div class="rounded-lg border border-primary/25 bg-primary/10 p-2 text-primary shadow-inner-line">
          <CreditCard size={22} aria-hidden="true" />
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="text-lg font-semibold text-foreground">Subscription</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            {#if isPro}
              You&apos;re on the HuntFlow Pro plan. Cloud sync, end-to-end encrypted evidence, and
              priority support are active across every signed-in device.
            {:else}
              You&apos;re on the free plan. Every local-first feature stays unlocked — upgrade to Pro
              when you want real-time cloud sync across every device.
            {/if}
          </p>
        </div>
      </div>

      <div class="mt-5 grid gap-4 lg:grid-cols-2">
        <article
          class="rounded-xl border bg-muted/30 p-4 {isPro
            ? 'border-primary/30 ring-1 ring-primary/20'
            : 'border-border'}"
        >
          <div class="flex items-baseline justify-between gap-3">
            <p class="text-sm font-semibold text-foreground">Current plan</p>
            <p class="text-sm font-semibold {isPro ? 'text-primary' : 'text-muted-foreground'}">
              {isPro ? 'HuntFlow Pro' : 'Free forever'}
            </p>
          </div>
          <ul class="mt-4 space-y-2 text-sm text-muted-foreground">
            {#if isPro}
              <li class="flex items-start gap-2">
                <Sparkles size={14} class="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                Real-time cloud sync across every device
              </li>
              <li class="flex items-start gap-2">
                <Shield size={14} class="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                End-to-end encrypted evidence and notes
              </li>
              <li class="flex items-start gap-2">
                <BadgeCheck size={14} class="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                Priority email support
              </li>
            {:else}
              <li>Unlimited targets, sessions, notes, recon, submissions</li>
              <li>Full local IndexedDB storage — works offline</li>
              <li>Encrypted manual backup &amp; restore</li>
            {/if}
          </ul>
        </article>

        <article class="rounded-xl border border-border bg-muted/30 p-4">
          <p class="text-sm font-semibold text-foreground">
            {isPro ? 'Manage your subscription' : 'Upgrade to Pro'}
          </p>
          <p class="mt-1 text-sm text-muted-foreground">
            {isPro
              ? 'Change plan, update payment method, or download invoices in the secure billing portal.'
              : 'Cloud sync, encrypted evidence, and priority support — $6/month or $60/year.'}
          </p>
          <div class="mt-4">
            {#if isPro}
              <button
                type="button"
                class="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                on:click={handleManageSubscription}
                disabled={openingSubscriptions}
              >
                <CreditCard size={14} aria-hidden="true" />
                {openingSubscriptions ? 'Opening…' : 'Manage subscription'}
              </button>
            {:else if IS_WEB}
              <a
                href="/pricing"
                class="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                <Sparkles size={14} aria-hidden="true" />
                Upgrade to Pro
                <ArrowRight size={14} aria-hidden="true" />
              </a>
            {:else}
              <!-- App build: /pricing was stripped by bin/build-app.mjs.
                   Send the user to the hosted billing page in a new tab. -->
              <a
                href="https://huntflow.xalgorix.com/pricing"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                <Sparkles size={14} aria-hidden="true" />
                Upgrade to Pro
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            {/if}
          </div>
        </article>
      </div>
    </section>

    <!-- Embedded Clerk UserProfile.
         This widget owns the long-tail of identity flows (change name,
         change password, manage email addresses, link Google/GitHub,
         enable 2FA, view & revoke active sessions, delete account).
         When Clerk Billing is enabled it also adds a Billing tab here,
         which is why we don't duplicate that surface ourselves. -->
    <section class="hf-card overflow-hidden p-0">
      <header class="border-b border-border/70 px-4 py-3 sm:px-6">
        <div class="flex items-center gap-2">
          <Shield size={16} class="text-primary" aria-hidden="true" />
          <h2 class="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Profile, security &amp; sessions
          </h2>
        </div>
      </header>

      {#if $clerkAuthStore.error}
        <div class="m-4 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-red-300 sm:m-6">
          {$clerkAuthStore.error}
        </div>
      {:else}
        <div bind:this={mountNode} id="hf-clerk-mount" class="hf-clerk-profile-mount" data-mounted={profileMounted}></div>
        {#if !profileMounted}
          <div class="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground" aria-live="polite">
            Loading profile&hellip;
          </div>
        {/if}
      {/if}
    </section>
    {/if}
  </div>
</main>

<style>
  /* ── Clerk UserProfile dark-theme overrides ─────────────────────
     Clerk's SDK injects CSS-in-JS with extremely high specificity
     (cl-internal-* randomly-suffixed classes) and sometimes inline
     styles. We use #id selectors (which beat any number of classes),
     !important on everything, and a runtime MutationObserver as
     a triple-layered defense to fully suppress light-mode styles. */

  /* Force dark color-scheme on the entire mount subtree */
  :global(#hf-clerk-mount) {
    width: 100% !important;
    padding: 0 !important;
    color-scheme: dark !important;
  }

  /* ── Root containers: transparent + full-width ── */
  :global(#hf-clerk-mount .cl-rootBox),
  :global(#hf-clerk-mount .cl-card),
  :global(#hf-clerk-mount .cl-cardBox),
  :global(#hf-clerk-mount .cl-userProfile-root),
  :global(#hf-clerk-mount .cl-pageScrollBox),
  :global(#hf-clerk-mount .cl-scrollBox),
  :global(#hf-clerk-mount .cl-page),
  :global(#hf-clerk-mount [class*='cl-userProfile']),
  :global(#hf-clerk-mount [class*='cl-main']),
  :global(#hf-clerk-mount [class*='cl-cardBox']) {
    background: transparent !important;
    background-color: transparent !important;
    box-shadow: none !important;
    border: none !important;
    width: 100% !important;
    max-width: 100% !important;
  }

  /* ── Sidebar navbar ── */
  :global(#hf-clerk-mount .cl-navbar),
  :global(#hf-clerk-mount [class*='cl-navbar']) {
    background: #0c1222 !important;
    background-color: #0c1222 !important;
    border-right: 1px solid #1e293b !important;
  }
  :global(#hf-clerk-mount .cl-navbarButton),
  :global(#hf-clerk-mount [class*='cl-navbarButton']) {
    color: #94a3b8 !important;
  }
  :global(#hf-clerk-mount .cl-navbarButton:hover),
  :global(#hf-clerk-mount [class*='cl-navbarButton']:hover) {
    background: rgba(20, 184, 166, 0.08) !important;
    background-color: rgba(20, 184, 166, 0.08) !important;
    color: #f1f5f9 !important;
  }
  :global(#hf-clerk-mount .cl-navbarButton[data-active='true']),
  :global(#hf-clerk-mount [class*='cl-navbarButton'][data-active]) {
    color: #14b8a6 !important;
    background: rgba(20, 184, 166, 0.08) !important;
    background-color: rgba(20, 184, 166, 0.08) !important;
  }

  /* ── Hide useless API keys nav tab ── */
  :global(#hf-clerk-mount .cl-navbarButton__apiKeys),
  :global(#hf-clerk-mount [class*='navbarButton__apiKeys']),
  :global(#hf-clerk-mount button[data-localization-key*='apiKeys']) {
    display: none !important;
  }

  /* ── Main content / scroll areas ── */
  :global(#hf-clerk-mount .cl-pageScrollBox),
  :global(#hf-clerk-mount .cl-page),
  :global(#hf-clerk-mount [class*='cl-page']),
  :global(#hf-clerk-mount [class*='cl-scrollBox']),
  :global(#hf-clerk-mount [class*='cl-content']) {
    background: transparent !important;
    background-color: transparent !important;
    flex: 1 1 0% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    width: 100% !important;
  }

  /* ── Profile sections ── */
  :global(#hf-clerk-mount .cl-profileSection),
  :global(#hf-clerk-mount [class*='cl-profileSection']) {
    border-color: #1e293b !important;
    background: transparent !important;
    background-color: transparent !important;
  }
  :global(#hf-clerk-mount .cl-profileSectionTitle),
  :global(#hf-clerk-mount .cl-profileSectionTitleText),
  :global(#hf-clerk-mount [class*='cl-profileSectionTitle']) {
    color: #94a3b8 !important;
    border: none !important;
    border-bottom: none !important;
    border-top: none !important;
  }
  /* Kill ALL borders on any child/descendant inside section title rows */
  :global(#hf-clerk-mount [class*='cl-profileSectionTitle'] *) {
    border: none !important;
    border-bottom: none !important;
    border-top: none !important;
  }
  /* Kill pseudo-element decorative lines in section titles */
  :global(#hf-clerk-mount [class*='cl-profileSectionTitle']::before),
  :global(#hf-clerk-mount [class*='cl-profileSectionTitle']::after),
  :global(#hf-clerk-mount [class*='cl-profileSectionTitle'] *::before),
  :global(#hf-clerk-mount [class*='cl-profileSectionTitle'] *::after) {
    border: none !important;
    background: transparent !important;
    display: none !important;
  }
  /* Also kill the header title area's decorative line */
  :global(#hf-clerk-mount [class*='cl-headerTitle'] ~ *),
  :global(#hf-clerk-mount [class*='cl-header'] > div:not([class*='cl-headerTitle'])) {
    border: none !important;
    border-bottom: none !important;
  }
  :global(#hf-clerk-mount .cl-profileSectionContent),
  :global(#hf-clerk-mount [class*='cl-profileSectionContent']) {
    background: transparent !important;
    background-color: transparent !important;
  }
  :global(#hf-clerk-mount .cl-profileSectionPrimaryButton),
  :global(#hf-clerk-mount [class*='cl-profileSectionPrimaryButton']) {
    color: #14b8a6 !important;
  }

  /* ── Section items / rows ── */
  :global(#hf-clerk-mount [class*='cl-profileSectionItem']),
  :global(#hf-clerk-mount [class*='cl-profileSectionRow']) {
    background: transparent !important;
    background-color: transparent !important;
  }

  /* ── Headers ── */
  :global(#hf-clerk-mount .cl-headerTitle),
  :global(#hf-clerk-mount [class*='cl-headerTitle']) {
    color: #f1f5f9 !important;
  }
  :global(#hf-clerk-mount .cl-headerSubtitle),
  :global(#hf-clerk-mount [class*='cl-headerSubtitle']) {
    color: #94a3b8 !important;
  }
  /* Remove partial-width border from page header area */
  :global(#hf-clerk-mount [class*='cl-header']),
  :global(#hf-clerk-mount .cl-header) {
    border-bottom: none !important;
  }

  /* ── Accordion / detail panels ── */
  :global(#hf-clerk-mount .cl-accordionContent),
  :global(#hf-clerk-mount [class*='cl-accordion']) {
    background: #0c1222 !important;
    background-color: #0c1222 !important;
  }
  :global(#hf-clerk-mount .cl-accordionTriggerButton),
  :global(#hf-clerk-mount [class*='cl-accordionTrigger']) {
    color: #f1f5f9 !important;
  }

  /* ── Active devices / sessions ── */
  :global(#hf-clerk-mount .cl-activeDeviceListItem),
  :global(#hf-clerk-mount [class*='cl-activeDevice']) {
    background: #0c1222 !important;
    border-color: #1e293b !important;
  }

  /* ── Forms ── */
  :global(#hf-clerk-mount [class*='cl-formField']) {
    color: #f1f5f9 !important;
  }
  :global(#hf-clerk-mount [class*='cl-formFieldLabel']) {
    color: #cbd5e1 !important;
  }
  :global(#hf-clerk-mount [class*='cl-formFieldInput']),
  :global(#hf-clerk-mount [class*='cl-input']) {
    background: #0f172a !important;
    background-color: #0f172a !important;
    border-color: #334155 !important;
    color: #f1f5f9 !important;
  }
  :global(#hf-clerk-mount [class*='cl-formButtonPrimary']) {
    background: #14b8a6 !important;
    color: #020617 !important;
  }

  /* ── Social buttons ── */
  :global(#hf-clerk-mount [class*='cl-socialButton']) {
    background: #1e293b !important;
    border-color: #334155 !important;
    color: #f1f5f9 !important;
  }

  /* ── Menus / dropdowns ── */
  :global(#hf-clerk-mount [class*='cl-menuList']),
  :global(#hf-clerk-mount [class*='cl-dropdown']) {
    background: #0f172a !important;
    border-color: #1e293b !important;
  }
  :global(#hf-clerk-mount [class*='cl-menuItem']) {
    color: #f1f5f9 !important;
  }
  :global(#hf-clerk-mount [class*='cl-menuItem']:hover) {
    background: #1e293b !important;
  }

  /* ── Badges ── */
  :global(#hf-clerk-mount [class*='cl-badge']) {
    background: rgba(20, 184, 166, 0.12) !important;
    color: #14b8a6 !important;
    border-color: rgba(20, 184, 166, 0.25) !important;
  }

  /* ── Footer (Clerk branding) ── */
  :global(#hf-clerk-mount .cl-footer),
  :global(#hf-clerk-mount [class*='cl-footer']),
  :global(#hf-clerk-mount [class*='cl-internal'][class*='footer']) {
    background: transparent !important;
    background-color: transparent !important;
  }

  /* ── Dividers ── */
  :global(#hf-clerk-mount [class*='cl-divider']) {
    background: #1e293b !important;
    border-color: #1e293b !important;
  }

  /* ── Text color normalization ── */
  :global(#hf-clerk-mount [class*='cl-text']) {
    color: #f1f5f9 !important;
  }
  :global(#hf-clerk-mount [class*='cl-label']) {
    color: #cbd5e1 !important;
  }

  /* ── Modals triggered from inside the widget ── */
  :global(#hf-clerk-mount [class*='cl-modal']),
  :global(#hf-clerk-mount [class*='cl-modalContent']) {
    background: #0f172a !important;
    border: 1px solid #1e293b !important;
  }

  /* ── NUCLEAR: catch ALL Clerk internal elements ──
     Clerk generates randomly-suffixed classes like cl-internal-1abc2d.
     The #id prefix ensures this beats Clerk's own selectors in
     specificity. This is the last-resort floor: transparent bg. */
  :global(#hf-clerk-mount [class*='cl-internal']) {
    background-color: transparent !important;
    color: inherit !important;
  }

  /* ── SUPER-NUCLEAR: catch absolutely ANY child element ──
     This brute-force rule targets every single descendant of
     the mount container and sets CSS custom properties that
     Clerk's CSS-in-JS may consume. */
  :global(#hf-clerk-mount *) {
    --clerk-color-background: #0f172a;
    --clerk-surface-background: transparent;
    --color-background: #0f172a;
  }

  /* Override any element that Clerk sets with a white-ish background */
  :global(#hf-clerk-mount div),
  :global(#hf-clerk-mount section),
  :global(#hf-clerk-mount article),
  :global(#hf-clerk-mount aside),
  :global(#hf-clerk-mount nav),
  :global(#hf-clerk-mount header) {
    border-color: #1e293b !important;
  }
</style>
