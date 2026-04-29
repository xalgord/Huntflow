<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { IS_WEB } from '$lib/buildTarget';
  import { clerkAuthStore, initClerk } from '$lib/cloud/clerk';
  import { startRealtimeSync, stopRealtimeSync } from '$lib/cloud/realtimeSync';
  import BottomNav from '$lib/components/layout/BottomNav.svelte';
  import CommandPalette from '$lib/components/command/CommandPalette.svelte';
  import KeyboardShortcutsHelp from '$lib/components/KeyboardShortcutsHelp.svelte';
  import MobileHeader from '$lib/components/layout/MobileHeader.svelte';
  import OnboardingModal from '$lib/components/onboarding/OnboardingModal.svelte';
  import PageTransition from '$lib/components/layout/PageTransition.svelte';
  import QuickCaptureModal from '$lib/components/quick-capture/QuickCaptureModal.svelte';
  import SideNav from '$lib/components/layout/SideNav.svelte';
  import InstallPrompt from '$lib/components/pwa/InstallPrompt.svelte';
  import OfflineBanner from '$lib/components/pwa/OfflineBanner.svelte';
  import { flushAllStores, settingsStore } from '$lib/stores';
  import { commandPaletteStore } from '$lib/stores/commandPaletteStore';
  import { quickCaptureStore } from '$lib/stores/quickCaptureStore';
  import { installGlobalShortcuts } from '$lib/utils/shortcuts';
  import { Crosshair } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import '../app.css';

  let navCollapsed = false;
  let navReady = false;
  let settingsReady = false;

  // Tracks whether onboarding has been forced for this navigation so we
  // don't repeatedly clear the flag on subsequent reactive re-evaluations.
  let welcomeNewHandled = false;

  const themeColors = {
    dark: '#09090b',
    light: '#fafafa',
    system: '#09090b'
  };

  onMount(async () => {
    await settingsStore.load();
    settingsReady = true;
    if (browser) {
      navCollapsed = localStorage.getItem('huntflow-side-nav-collapsed') === 'true';
      navReady = true;
      document.documentElement.dataset.huntflowReady = 'true';

      // Boot Clerk eagerly so the auth state resolves before the user
      // can interact with any protected route. Without this, clerk only
      // initializes when /sign-in or settings mount, which would briefly
      // expose the dashboard to anonymous visitors.
      void initClerk();

      // Drain debounced store writes (500ms timer) before the tab is unloaded
      // so the latest session state, notes, recon edits, etc. always survive
      // a quick close after an action. `pagehide` fires reliably on mobile
      // Safari/Chrome where `beforeunload` does not.
      const handleUnload = () => {
        void flushAllStores();
      };
      window.addEventListener('pagehide', handleUnload);
      window.addEventListener('beforeunload', handleUnload);
      // Also flush when the page is just hidden (mobile app switch) so
      // background-killed tabs don't lose recent edits.
      const handleVisibility = () => {
        if (document.visibilityState === 'hidden') void flushAllStores();
      };
      document.addEventListener('visibilitychange', handleVisibility);

      // Global Cmd/Ctrl+K opens the Command Palette from anywhere except
      // when the user is typing inside an input/textarea/contenteditable
      // (those should still get their normal Ctrl+K behavior).
      // Cmd/Ctrl+Shift+K is the dedicated Quick Capture hotkey — the
      // single most-used shortcut for live hunting, mirroring how
      // Raycast / Linear treat their primary "create" key.
      const handleKeyShortcut = (event: KeyboardEvent) => {
        const isCmd = event.metaKey || event.ctrlKey;
        if (!isCmd) return;
        const key = event.key.toLowerCase();
        if (key !== 'k') return;

        const target = event.target as HTMLElement | null;
        const tag = target?.tagName;
        const editable = target?.isContentEditable;
        const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || editable;

        // Cmd/Ctrl+Shift+K → Quick Capture (works from inside fields too —
        // that's the whole point of "capture from anywhere"). We pre-seed
        // the modal with whatever the user already had typed when they
        // hit the hotkey from inside an input/textarea so nothing gets
        // discarded.
        if (event.shiftKey) {
          event.preventDefault();
          let seed = '';
          if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            seed = target.value ?? '';
          }
          quickCaptureStore.open(seed ? { initialText: seed } : {});
          return;
        }

        if (tag === 'SELECT') return;
        event.preventDefault();
        if (inField && target instanceof HTMLInputElement && target.value) {
          // Pre-seed the palette with whatever the user was already typing.
          commandPaletteStore.open(target.value);
        } else {
          commandPaletteStore.toggle();
        }
      };
      window.addEventListener('keydown', handleKeyShortcut);

      // Forward-slash also opens the palette (when not in a field), matching
      // GitHub/Linear conventions.
      const handleSlash = (event: KeyboardEvent) => {
        if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target?.isContentEditable
        )
          return;
        event.preventDefault();
        commandPaletteStore.open();
      };
      window.addEventListener('keydown', handleSlash);

      // Two-key navigation sequences (g d, g t, g r, …), `c` for create,
      // and `?` for the help cheatsheet. Reads pathname lazily so the `c`
      // shortcut always knows the current route.
      installGlobalShortcuts(() => $page.url.pathname);
    }
  });

  $: pathname = $page.url.pathname;
  $: canonicalUrl = `${$page.url.origin}${pathname}`;
  // Treat marketing/auth/billing pages as "no-chrome": they have their own
  // headers and footers and don't need the side nav, bottom nav, or
  // command palette overlays. Keeps the marketing surface decoupled from
  // the app shell.
  //
  // In the app build (`IS_APP`), the landing page is replaced with a
  // dashboard redirect stub and `/pricing` and `/demo` are stripped from
  // `src/routes/` entirely (see `bin/build-app.mjs`). The auth pages
  // remain in both targets because cloud sync is opt-in for app users —
  // we just frame them differently in app mode.
  //
  // Auth pages (`/sign-in`, `/sign-up`) keep the chromeless treatment in
  // app mode too, since `AuthShell` already provides a self-contained
  // frame and the side nav would crowd the embedded Clerk widget.
  // /account is chromeless (marketing layout) only when the user is NOT
  // signed in — guests see a full-page sign-in CTA without the app shell.
  // Once signed in, /account behaves like a normal app page with sidebar.
  $: isMarketing =
    (IS_WEB && pathname === '/') ||
    pathname === '/sign-in' ||
    pathname === '/sign-up' ||
    (pathname === '/account' && !clerkSignedIn) ||
    (IS_WEB && pathname === '/pricing') ||
    (IS_WEB && pathname === '/demo') ||
    pathname.startsWith('/sign-in/') ||
    pathname.startsWith('/sign-up/');
  $: isLanding = isMarketing;

  // Auth gate. In the hosted web build, app routes require a Clerk
  // session WHEN Clerk is configured. In the local app build (`IS_APP`),
  // **every route is open** — sign-in is purely opt-in for cloud sync
  // and never blocks access. Anonymous users get a fresh local-only
  // workspace stored in IndexedDB.
  $: requiresAuth = IS_WEB && !isMarketing;

  // Detect ?welcome=new injected by the sign-up page after a fresh Clerk
  // account is created. When present, we force onboardingCompleted = false
  // so the modal always fires for new signups — regardless of any stale
  // IndexedDB value left from a previous local/demo session on this device.
  // We clean up the URL param immediately with replaceState so it doesn't
  // linger in the browser history or get bookmarked.
  $: if (
    browser &&
    !welcomeNewHandled &&
    settingsReady &&
    clerkSignedIn &&
    $page.url.searchParams.get('welcome') === 'new'
  ) {
    welcomeNewHandled = true;
    void settingsStore.setValue('onboardingCompleted', false);
    const cleanUrl = new URL($page.url.toString());
    cleanUrl.searchParams.delete('welcome');
    history.replaceState(history.state, '', cleanUrl.toString());
  }
  $: clerkConfigured = $clerkAuthStore.configured;
  $: clerkLoading = $clerkAuthStore.loading;
  $: clerkSignedIn = $clerkAuthStore.signedIn;

  // Real-time sync lifecycle: start when Pro is confirmed, stop otherwise.
  // The reactive block re-evaluates whenever signedIn, isPro, or
  // convexAuthenticated changes so the engine toggles automatically on
  // sign-in/sign-out and subscription changes.
  $: if (browser) {
    const shouldSync =
      $clerkAuthStore.signedIn &&
      $clerkAuthStore.isPro &&
      $clerkAuthStore.convexAuthenticated;
    if (shouldSync) {
      startRealtimeSync();
    } else {
      stopRealtimeSync();
    }
  }

  // Demo mode: when a visitor enters via /demo we set this tab-scoped
  // sessionStorage flag, which lets them navigate the seeded workspace
  // without being bounced to /sign-in. Closing the tab clears the flag,
  // so Clerk remains the source of truth for any non-demo session.
  // We re-read on every pathname change so navigation through the seeded
  // app keeps the flag honored even after a soft route swap.
  let demoMode = false;
  $: if (browser) {
    pathname; // re-evaluate on route change
    try {
      demoMode = sessionStorage.getItem('huntflow-demo-mode') === '1';
    } catch {
      demoMode = false;
    }
  }

  // Block the app shell from rendering while we're either waiting on Clerk
  // to load or about to redirect an anonymous visitor to /sign-in. This
  // prevents the protected dashboard from flashing into view before the
  // redirect lands. Demo mode skips the spinner entirely so the seeded
  // workspace renders immediately. In app mode `requiresAuth` is always
  // false, so this whole branch dead-codes away.
  $: authBlocking =
    browser && requiresAuth && clerkConfigured && !demoMode && (clerkLoading || !clerkSignedIn);

  // Once Clerk has finished loading and we still don't have a session,
  // bounce to the sign-in page with a return path so the user lands back
  // here after authenticating. Demo-mode tabs are exempt — the visitor
  // is exploring sample data, not their own workspace. App-mode skips
  // this entirely (sign-in is opt-in for cloud sync, not a gate).
  $: if (
    browser &&
    requiresAuth &&
    clerkConfigured &&
    !demoMode &&
    !clerkLoading &&
    !clerkSignedIn
  ) {
    const target = `${pathname}${$page.url.search}`;
    void goto(`/sign-in?redirect=${encodeURIComponent(target)}`, { replaceState: true });
  }

  $: if (browser && navReady) {
    localStorage.setItem('huntflow-side-nav-collapsed', String(navCollapsed));
  }
</script>

<svelte:head>
  <meta name="theme-color" content={themeColors[$settingsStore.theme]} />
  <link rel="canonical" href={canonicalUrl} />
  <meta name="robots" content="index,follow" />
  <meta property="og:url" content={canonicalUrl} />
</svelte:head>

<OfflineBanner />

{#if authBlocking}
  <!-- Auth gate: hold the protected app shell back until Clerk resolves.
       Renders a centered spinner that matches the dark theme rather than
       any of the app pages. The reactive block above will navigate to
       /sign-in once Clerk reports !signedIn. -->
  <main
    class="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-300"
    aria-busy="true"
    aria-live="polite"
  >
    <div class="flex flex-col items-center gap-4 text-center">
      <span
        class="flex h-12 w-12 items-center justify-center rounded-xl border border-primary-500/30 bg-primary-500/10 text-primary-400"
      >
        <Crosshair size={22} aria-hidden="true" />
      </span>
      <p class="text-sm font-medium text-slate-200">Checking your session&hellip;</p>
      <p class="max-w-xs text-xs text-slate-500">
        HuntFlow is verifying your account. You&apos;ll be redirected to sign in if you&apos;re not already
        authenticated.
      </p>
    </div>
  </main>
{:else}
  <div class="hf-shell">
    {#if !isLanding}
      <SideNav {pathname} bind:collapsed={navCollapsed} />
      <MobileHeader {pathname} />
    {/if}

    <main
      class="relative min-h-screen {isLanding
        ? ''
        : `pt-[calc(max(env(safe-area-inset-top),0px)+8.5rem)] transition-[padding] duration-200 lg:pt-0 ${
            navCollapsed ? 'lg:pl-16' : 'lg:pl-56'
          }`}"
    >
      <PageTransition name={pathname}>
        <slot />
      </PageTransition>
    </main>

    {#if !isLanding}
      <BottomNav {pathname} />
    {/if}
  </div>

  <div
    id="toast-container"
    class="pointer-events-none fixed inset-x-4 top-4 z-[60] flex flex-col gap-3 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-auto sm:w-96"
    aria-live="polite"
    aria-atomic="true"
  ></div>

  <InstallPrompt />

  {#if !isLanding && settingsReady && !$settingsStore.onboardingCompleted}
    <OnboardingModal open isPro={$clerkAuthStore.isPro ?? false} />
  {/if}

  {#if !isLanding}
    <CommandPalette />
    <QuickCaptureModal />
    <KeyboardShortcutsHelp />
  {/if}
{/if}
