<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { IS_WEB } from '$lib/buildTarget';
  import { authStore, initFirebase } from '$lib/cloud/firebase';
  import { startRealtimeSync, stopRealtimeSync } from '$lib/cloud/realtimeSync';
  import { shouldStartRealtimeSync } from '$lib/cloud/syncGating';
  import CommandPalette from '$lib/components/command/CommandPalette.svelte';
  import KeyboardShortcutsHelp from '$lib/components/KeyboardShortcutsHelp.svelte';
  import OnboardingModal from '$lib/components/onboarding/OnboardingModal.svelte';
  import PageTransition from '$lib/components/layout/PageTransition.svelte';
  import QuickCaptureModal from '$lib/components/quick-capture/QuickCaptureModal.svelte';
  import InstallPrompt from '$lib/components/pwa/InstallPrompt.svelte';
  import OfflineBanner from '$lib/components/pwa/OfflineBanner.svelte';
  import AppShell from '$lib/components/workspace/AppShell.svelte';
  import { flushAllStores, settingsStore } from '$lib/stores';
  import { commandPaletteStore } from '$lib/stores/commandPaletteStore';
  import { quickCaptureStore } from '$lib/stores/quickCaptureStore';
  import { installGlobalShortcuts } from '$lib/utils/shortcuts';
  import { onMount } from 'svelte';
  import '../app.css';

  let navCollapsed = false;
  let navReady = false;
  let settingsReady = false;

  // Tracks whether onboarding has been forced for this navigation so we
  // don't repeatedly clear the flag on subsequent reactive re-evaluations.
  let welcomeNewHandled = false;

  const themeColors = {
    dark: '#000000',
    light: '#fafafa',
    system: '#000000'
  };

  function normalizePathname(path: string): string {
    if (path === '/') return path;
    return path.replace(/\/+$/, '') || '/';
  }

  // One-time defensive clear of any residual session cookies left behind
  // by the previous auth provider. The string literals below reference
  // browser-side cookie *names* (not source identifiers) and exist because
  // users who upgraded into the new bundle may still have stale entries
  // that the new auth surface must not honor. Names are matched as
  // prefixes because the previous provider versioned its cookie names
  // per app instance.
  // See Requirement 14.3.
  function clearLegacySessionCookies(): void {
    if (!browser) return;
    const raw = document.cookie;
    if (!raw) return;
    const parts = raw.split(';');
    for (const part of parts) {
      const eq = part.indexOf('=');
      const name = (eq === -1 ? part : part.slice(0, eq)).trim();
      if (!name) continue;
      if (name.startsWith('__session_clerk_') || name.startsWith('__client_clerk_')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
    }
  }

  onMount(() => {
    // Run the async boot in a self-invoking IIFE so onMount can return a
    // synchronous cleanup. Returning a Promise from onMount silently
    // discards the cleanup — that's how we used to leak listeners across
    // HMR reloads.
    const cleanups: Array<() => void> = [];

    void (async () => {
      await settingsStore.load();
      settingsReady = true;

      if (!browser) return;

      // Defensive: nuke any residual session cookies from the previous
      // auth provider on the very first mount of the new bundle. Runs
      // exactly once per page lifecycle.
      clearLegacySessionCookies();

      navCollapsed = localStorage.getItem('huntflow-side-nav-collapsed') === 'true';
      navReady = true;
      document.documentElement.dataset.huntflowReady = 'true';

      // Demo mode is set on entry to /demo and is tab-scoped via
      // sessionStorage. Read it once on mount — it never changes within a
      // tab session, so the previous reactive re-read on every navigation
      // was wasted work.
      try {
        demoMode = sessionStorage.getItem('huntflow-demo-mode') === '1';
      } catch {
        demoMode = false;
      }

      // Core HuntFlow routes are local-first and never require sign-in.
      // Auth bootstraps only on auth/account surfaces where optional
      // cloud identity is relevant.
      if (
        pathname === '/account' ||
        pathname.startsWith('/sign-in') ||
        pathname.startsWith('/sign-up')
      ) {
        void initFirebase();
      }

      // Drain debounced store writes (500ms timer) before the tab is unloaded
      // so the latest session state, notes, recon edits, etc. always survive
      // a quick close after an action. `pagehide` fires reliably on mobile
      // Safari/Chrome where `beforeunload` does not.
      const handleUnload = () => {
        void flushAllStores();
      };
      window.addEventListener('pagehide', handleUnload);
      window.addEventListener('beforeunload', handleUnload);
      cleanups.push(() => window.removeEventListener('pagehide', handleUnload));
      cleanups.push(() => window.removeEventListener('beforeunload', handleUnload));

      // Also flush when the page is just hidden (mobile app switch) so
      // background-killed tabs don't lose recent edits.
      const handleVisibility = () => {
        if (document.visibilityState === 'hidden') void flushAllStores();
      };
      document.addEventListener('visibilitychange', handleVisibility);
      cleanups.push(() => document.removeEventListener('visibilitychange', handleVisibility));

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
      cleanups.push(() => window.removeEventListener('keydown', handleKeyShortcut));

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
      cleanups.push(() => window.removeEventListener('keydown', handleSlash));

      // Two-key navigation sequences (g d, g t, g r, …), `c` for create,
      // and `?` for the help cheatsheet. Reads pathname lazily so the `c`
      // shortcut always knows the current route.
      const removeShortcuts = installGlobalShortcuts(() => $page.url.pathname);
      cleanups.push(removeShortcuts);
    })();

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  });

  $: pathname = normalizePathname($page.url.pathname);
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
  // frame and the side nav would crowd the embedded auth widget.
  // /account is chromeless (marketing layout) only when the user is NOT
  // signed in — guests see a full-page sign-in CTA without the app shell.
  // Once signed in, /account behaves like a normal app page with sidebar.
  $: isMarketing =
    (IS_WEB && pathname === '/') ||
    pathname === '/sign-in' ||
    pathname === '/sign-up' ||
    (pathname === '/account' && !signedIn) ||
    (IS_WEB && pathname === '/pricing') ||
    (IS_WEB && pathname === '/demo') ||
    pathname.startsWith('/sign-in/') ||
    pathname.startsWith('/sign-up/');
  $: isLanding = isMarketing;

  // Detect ?welcome=new injected by the sign-up page after a fresh
  // account is created. When present, we force onboardingCompleted = false
  // so the modal always fires for new signups — regardless of any stale
  // IndexedDB value left from a previous local/demo session on this device.
  // We clean up the URL param immediately with replaceState so it doesn't
  // linger in the browser history or get bookmarked.
  $: if (
    browser &&
    !welcomeNewHandled &&
    settingsReady &&
    signedIn &&
    $page.url.searchParams.get('welcome') === 'new'
  ) {
    welcomeNewHandled = true;
    void settingsStore.setValue('onboardingCompleted', false);
    const cleanUrl = new URL($page.url.toString());
    cleanUrl.searchParams.delete('welcome');
    history.replaceState(history.state, '', cleanUrl.toString());
  }
  $: signedIn = $authStore.signedIn;

  // Real-time sync lifecycle: start when Pro is confirmed, stop otherwise.
  // The reactive block re-evaluates whenever signedIn, isPro, or
  // convexAuthenticated changes so the engine toggles automatically on
  // sign-in/sign-out and subscription changes. The actual gate
  // decision lives in `shouldStartRealtimeSync` (Property 4) so the
  // rule is testable without spinning up the layout.
  $: if (browser) {
    const shouldSync = shouldStartRealtimeSync({
      signedIn: $authStore.signedIn,
      isPro: $authStore.isPro,
      convexAuthenticated: $authStore.convexAuthenticated
    });
    if (shouldSync) {
      startRealtimeSync();
    } else {
      stopRealtimeSync();
    }
  }

  // Demo mode flag set once in onMount — sessionStorage doesn't change
  // mid-tab, so reading it on every pathname change was just busy work.
  let demoMode = false;

  $: if (browser && navReady) {
    localStorage.setItem('huntflow-side-nav-collapsed', String(navCollapsed));
  }
</script>

<svelte:head>
  <meta name="theme-color" content={themeColors[$settingsStore.theme]} />
  {#if !isLanding}
    <link rel="canonical" href={canonicalUrl} />
    <meta name="robots" content="index,follow" />
    <meta property="og:url" content={canonicalUrl} />
  {/if}
</svelte:head>

<OfflineBanner />

<div class="hf-shell">
  {#if isLanding}
    <main class="relative min-h-screen">
      <PageTransition name={pathname}>
        <slot />
      </PageTransition>
    </main>
  {:else}
    <AppShell {pathname} bind:collapsed={navCollapsed}>
      <PageTransition name={pathname}>
        <slot />
      </PageTransition>
    </AppShell>
  {/if}
</div>

<div
  id="toast-container"
  class="pointer-events-none fixed inset-x-4 top-4 z-[60] flex flex-col gap-3 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-auto sm:w-96"
  aria-live="polite"
  aria-atomic="true"
></div>

{#if !isLanding && settingsReady && !$settingsStore.onboardingCompleted}
  <OnboardingModal open isPro={$authStore.isPro ?? false} />
{/if}

{#if !isLanding}
  <InstallPrompt />
  <CommandPalette />
  <QuickCaptureModal />
  <KeyboardShortcutsHelp />
{/if}
