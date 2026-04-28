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
  import {
    clerkAuthStore,
    initClerk,
    mountClerkUserProfile,
    openClerkSubscriptions,
    signOutFromClerk
  } from '$lib/cloud/clerk';
  import {
    ArrowRight,
    BadgeCheck,
    CreditCard,
    LogOut,
    Mail,
    Settings as SettingsIcon,
    Shield,
    Sparkles,
    UserRound
  } from 'lucide-svelte';
  import { onDestroy, onMount } from 'svelte';

  let mountNode: HTMLDivElement | null = null;
  let unmountProfile: (() => void) | null = null;
  let profileMounted = false;
  let openingSubscriptions = false;
  let signingOut = false;

  onMount(async () => {
    if (!browser) return;
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
  });

  onDestroy(() => {
    unmountProfile?.();
  });

  async function handleManageSubscription(): Promise<void> {
    openingSubscriptions = true;
    try {
      const opened = await openClerkSubscriptions();
      // If Clerk doesn't expose a subscriptions modal on this instance,
      // bounce to /pricing where the embedded PricingTable lets the
      // user change plans. That's a graceful fallback — never a
      // dead-end button.
      if (!opened) {
        window.location.href = '/pricing';
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
</script>

<svelte:head>
  <title>Account &middot; HuntFlow</title>
  <meta name="description" content="Manage your HuntFlow profile, security, sessions, and subscription." />
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner max-w-5xl">
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
            {:else}
              <a
                href="/pricing"
                class="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                <Sparkles size={14} aria-hidden="true" />
                Upgrade to Pro
                <ArrowRight size={14} aria-hidden="true" />
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

      {#if !$clerkAuthStore.configured}
        <div class="m-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100 sm:m-6">
          Account management is currently disabled because Clerk is not configured. Set
          <span class="font-mono text-amber-200">VITE_CLERK_PUBLISHABLE_KEY</span> to enable it.
        </div>
      {:else if $clerkAuthStore.error}
        <div class="m-4 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-red-300 sm:m-6">
          {$clerkAuthStore.error}
        </div>
      {:else}
        <div bind:this={mountNode} class="hf-clerk-profile-mount" data-mounted={profileMounted}></div>
        {#if !profileMounted}
          <div class="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground" aria-live="polite">
            Loading profile&hellip;
          </div>
        {/if}
      {/if}
    </section>
  </div>
</main>

<style>
  /* Strip Clerk's white card so it inherits the hf-card look. */
  :global(.hf-clerk-profile-mount) {
    width: 100%;
    padding: 0;
  }
  :global(.hf-clerk-profile-mount .cl-rootBox),
  :global(.hf-clerk-profile-mount .cl-card) {
    background: transparent !important;
    box-shadow: none !important;
    border: none !important;
    width: 100% !important;
  }
  :global(.hf-clerk-profile-mount .cl-navbar),
  :global(.hf-clerk-profile-mount .cl-pageScrollBox) {
    background: transparent !important;
  }
</style>
