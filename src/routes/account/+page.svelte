<script lang="ts">
  /**
   * `/account` — the canonical user account hub.
   *
   * After the Firebase Auth migration, this page no longer mounts a
   * third-party widget. It composes four custom Svelte cards in the
   * exact visual order specified by the design:
   *
   *   1. EmailVerificationBanner — amber nudge for unverified emails.
   *   2. AccountProfileCard      — display name, email, providers,
   *                                avatar, verification indicator.
   *   3. SubscriptionCard        — Upgrade or Manage subscription via
   *                                Dodo Payments.
   *   4. AccountDeleteCard       — destructive two-step delete with
   *                                provider-aware re-authentication.
   *
   * The page renders one of three modes:
   *
   *   - `localView` — Firebase isn't configured (legacy / local-only
   *     install). Shows a private-workspace summary with a link to
   *     /settings. No identity surface.
   *
   *   - `guestView` — configured but signed out. The +layout.svelte
   *     treats this as a marketing/auth surface and strips the side
   *     nav, so the page renders a centered, non-branded sign-in CTA
   *     pointing at /sign-in.
   *
   *   - `signedInView` — configured and signed in. Renders the four
   *     auth cards plus an optional non-branded status banner above
   *     them when ?upgrade=success or ?upgrade=cancelled is present
   *     (set by SubscriptionCard's checkout return URLs).
   *
   * Brand-clean by construction: no third-party widgets, no remote
   * scripts, no "Secured by" / "Powered by" copy. Every visible string
   * is HuntFlow-owned. Property 5 (brand-clean rendering) holds.
   *
   * Feature: firebase-auth-migration
   * Validates: Requirements 5.1, 5.2, 5.3, 5.5, 8.3, 10.1, 10.3
   */

  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { IS_APP, IS_WEB } from '$lib/buildTarget';
  import { authStore } from '$lib/cloud/firebase';
  import AccountDeleteCard from '$lib/components/auth/AccountDeleteCard.svelte';
  import AccountProfileCard from '$lib/components/auth/AccountProfileCard.svelte';
  import EmailVerificationBanner from '$lib/components/auth/EmailVerificationBanner.svelte';
  import SubscriptionCard from '$lib/components/auth/SubscriptionCard.svelte';
  import {
    ArrowRight,
    CheckCircle2,
    Cloud,
    Database,
    ExternalLink,
    HardDrive,
    Info,
    LogIn,
    Settings as SettingsIcon,
    Sparkles,
    UserRound,
    X
  } from 'lucide-svelte';

  // ---------------------------------------------------------------------------
  // Upgrade-return banner
  //
  // SubscriptionCard sets the Dodo checkout `return_url` to
  // `${origin}/account?upgrade=success` and `cancel_url` to
  // `${origin}/account?upgrade=cancelled`. When the browser comes back
  // from the Dodo-hosted checkout we render a transient, non-branded
  // status banner above the cards and strip the param from the URL so
  // it doesn't reappear on refresh, share, or back-navigation.
  //
  // The banner is dismissible. The Pro entitlement itself is delivered
  // by Convex's live `entitlements` query (driven by the webhook), not
  // by the query param — the banner just acknowledges the user's
  // intent so they see immediate feedback even before the webhook
  // round-trip lands.
  // ---------------------------------------------------------------------------

  type UpgradeStatus = 'success' | 'cancelled' | null;

  let upgradeStatus: UpgradeStatus = null;
  let upgradeStatusHandled = false;

  $: if (browser && !upgradeStatusHandled) {
    const raw = $page.url.searchParams.get('upgrade');
    if (raw === 'success' || raw === 'cancelled') {
      upgradeStatus = raw;
      upgradeStatusHandled = true;
      const cleanUrl = new URL($page.url.toString());
      cleanUrl.searchParams.delete('upgrade');
      history.replaceState(history.state, '', cleanUrl.toString());
    } else {
      upgradeStatusHandled = true;
    }
  }

  function dismissUpgradeBanner(): void {
    upgradeStatus = null;
  }

  // ---------------------------------------------------------------------------
  // View-mode selectors
  //
  // The three modes are mutually exclusive and driven entirely by the
  // auth store. Each is reactive so the page transitions smoothly when
  // the user signs in or out without a route change. The +layout.svelte
  // marketing-surface predicate keys off `signedIn`, so the side nav
  // appears or disappears in lockstep with `signedInView`.
  // ---------------------------------------------------------------------------

  $: localView = !$authStore.configured;
  $: guestView = $authStore.configured && !$authStore.signedIn;
  $: signedInView = $authStore.configured && $authStore.signedIn;

  $: pageTitle = $authStore.configured ? 'Account' : 'Local workspace';
  $: pageDescription = $authStore.configured
    ? 'Manage your HuntFlow profile, email verification, and subscription.'
    : 'You\u2019re running HuntFlow privately on this device.';
</script>

<svelte:head>
  <title>{pageTitle} &middot; HuntFlow</title>
  <meta name="description" content={pageDescription} />
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner max-w-3xl">
    {#if localView}
      <!--
        Local-workspace view (no Firebase config). The app is running
        as a private offline install — there's no identity to surface.
        We point users at /settings for the practical actions
        (backups, import, reset) and surface the marketing site for
        anyone who wants cloud sync.
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

      {#if IS_APP}
        <!--
          App build, no auth configured. The user is on the desktop /
          PWA build and cloud sync isn't wired up locally. Surface the
          hosted version as an outbound link.
        -->
        <section class="hf-card p-4 sm:p-6">
          <div class="flex items-start gap-3">
            <div class="rounded-lg border border-primary/25 bg-primary/10 p-2 text-primary shadow-inner-line">
              <Cloud size={22} aria-hidden="true" />
            </div>
            <div class="min-w-0 flex-1">
              <h2 class="text-lg font-semibold text-foreground">Want it on every device?</h2>
              <p class="mt-1 text-sm text-muted-foreground">
                The hosted version at
                <span class="font-medium text-foreground">huntflow.xalgorix.com</span>
                adds real-time cloud sync and end-to-end encrypted evidence. Same app, plus a
                sync backbone. Your local install keeps working either way.
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
            </div>
          </div>
        </section>
      {/if}

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
    {:else if guestView}
      <!--
        Guest view: configured but signed out. The +layout.svelte
        marketing-surface predicate keys off the same condition and
        strips the side nav, so this renders as a centered, full-page
        sign-in CTA without competing chrome. Brand-clean: no
        third-party badges, no provider names in the copy.
      -->
      <header class="hf-page-header">
        <div class="flex items-start gap-3">
          <div class="rounded-lg border border-primary/25 bg-primary/10 p-2 text-primary shadow-inner-line">
            <UserRound size={28} aria-hidden="true" />
          </div>
          <div class="min-w-0">
            <p class="hf-eyebrow">Account</p>
            <h1 class="hf-title">Sign in to manage your account</h1>
            <p class="hf-description">
              Sign in to manage your profile, email verification, and HuntFlow Pro subscription.
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

          <div class="flex flex-col items-center gap-6 py-6 text-center">
            <span
              class="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-dark-sm"
              aria-hidden="true"
            >
              <LogIn size={36} />
            </span>

            <div class="max-w-md">
              <h2 class="text-2xl font-bold text-foreground">Sign in to your account</h2>
              <p class="mt-2 text-sm text-muted-foreground">
                Access your profile, manage email verification, and control your HuntFlow Pro
                subscription.
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

      <!--
        Value-prop teaser. Helps the user understand what's behind the
        gate without leaning on third-party brand language. IS_WEB only:
        the web build hosts the marketing surface; the app build's
        guestView (rare — most app users are signed in or in localView)
        skips the teaser to keep the focus on the sign-in CTA.
      -->
      {#if IS_WEB}
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
                  <CheckCircle2 size={14} class="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                  End-to-end encrypted evidence and notes
                </li>
                <li class="flex items-start gap-2">
                  <Sparkles size={14} class="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                  HuntFlow Pro features when you're ready
                </li>
              </ul>
            </div>
          </div>
        </section>
      {/if}
    {:else if signedInView}
      <!--
        Signed-in view. Renders, in this exact visual order:
          0. Optional upgrade-return banner (?upgrade=success/cancelled)
          1. EmailVerificationBanner
          2. AccountProfileCard
          3. SubscriptionCard
          4. AccountDeleteCard
        No third-party widgets, no remote scripts, no brand badges.
      -->
      {#if upgradeStatus === 'success'}
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
              Your Pro plan is on its way. Real-time cloud sync and end-to-end encrypted
              evidence will activate automatically across every signed-in device — usually
              within a few seconds.
            </p>
          </div>
          <button
            type="button"
            class="ml-2 shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Dismiss upgrade banner"
            on:click={dismissUpgradeBanner}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      {:else if upgradeStatus === 'cancelled'}
        <div
          role="status"
          aria-live="polite"
          class="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm ring-1 ring-zinc-900"
        >
          <Info
            size={20}
            class="mt-0.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-foreground">Checkout cancelled</p>
            <p class="mt-0.5 text-muted-foreground">
              No charge was made. You can retry the upgrade any time from the subscription
              card below.
            </p>
          </div>
          <button
            type="button"
            class="ml-2 shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Dismiss cancellation banner"
            on:click={dismissUpgradeBanner}
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
              Manage your profile, email verification, and HuntFlow Pro subscription. App-level
              preferences (timer, theme, backups) live in
              <a href="/settings" class="text-primary-300 underline-offset-4 hover:underline">Settings</a>.
            </p>
          </div>
        </div>
      </header>

      <!-- 1. Email verification banner (only renders for unverified users) -->
      <EmailVerificationBanner />

      <!-- 2. Profile card -->
      <AccountProfileCard />

      <!-- 3. Subscription card -->
      <SubscriptionCard />

      <!-- 4. Delete card -->
      <AccountDeleteCard />
    {/if}
  </div>
</main>
