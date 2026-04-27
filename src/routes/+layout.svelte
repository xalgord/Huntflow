<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { clerkAuthStore, initClerk } from '$lib/cloud/clerk';
  import BottomNav from '$lib/components/layout/BottomNav.svelte';
  import CommandPalette from '$lib/components/command/CommandPalette.svelte';
  import KeyboardShortcutsHelp from '$lib/components/KeyboardShortcutsHelp.svelte';
  import MobileHeader from '$lib/components/layout/MobileHeader.svelte';
  import OnboardingModal from '$lib/components/onboarding/OnboardingModal.svelte';
  import PageTransition from '$lib/components/layout/PageTransition.svelte';
  import SideNav from '$lib/components/layout/SideNav.svelte';
  import InstallPrompt from '$lib/components/pwa/InstallPrompt.svelte';
  import OfflineBanner from '$lib/components/pwa/OfflineBanner.svelte';
  import { flushAllStores, settingsStore } from '$lib/stores';
  import { commandPaletteStore } from '$lib/stores/commandPaletteStore';
  import { installGlobalShortcuts } from '$lib/utils/shortcuts';
  import { Crosshair } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import '../app.css';

  let navCollapsed = false;
  let navReady = false;
  let settingsReady = false;

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
      const handleKeyShortcut = (event: KeyboardEvent) => {
        const isCmdK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
        if (!isCmdK) return;
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName;
        const editable = target?.isContentEditable;
        const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || editable;
        // Allow the shortcut even from inputs — that's what users expect
        // from Linear/Notion/Raycast — but don't block native shortcuts on
        // selects.
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
  // The root `/` is the public marketing landing page. Auth, pricing, and
  // any nested Clerk catch-all routes (sign-in/factor-one, etc.) are also
  // chromeless so they have their own headers/footers and don't render
  // the app shell, side nav, or command palette overlays.
  $: isMarketing =
    pathname === '/' ||
    pathname === '/sign-in' ||
    pathname === '/sign-up' ||
    pathname === '/pricing' ||
    pathname === '/demo' ||
    pathname.startsWith('/sign-in/') ||
    pathname.startsWith('/sign-up/');
  $: isLanding = isMarketing;

  // Auth gate. Marketing pages are always public. App routes require a
  // Clerk session WHEN Clerk is configured. If Clerk isn't configured
  // (self-hosted/local-only mode with no VITE_CLERK_PUBLISHABLE_KEY),
  // the app stays open so the offline-first experience still works.
  $: requiresAuth = !isMarketing;
  $: clerkConfigured = $clerkAuthStore.configured;
  $: clerkLoading = $clerkAuthStore.loading;
  $: clerkSignedIn = $clerkAuthStore.signedIn;

  // Block the app shell from rendering while we're either waiting on Clerk
  // to load or about to redirect an anonymous visitor to /sign-in. This
  // prevents the protected dashboard from flashing into view before the
  // redirect lands.
  $: authBlocking =
    browser && requiresAuth && clerkConfigured && (clerkLoading || !clerkSignedIn);

  // Once Clerk has finished loading and we still don't have a session,
  // bounce to the sign-in page with a return path so the user lands back
  // here after authenticating.
  $: if (
    browser &&
    requiresAuth &&
    clerkConfigured &&
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
    <OnboardingModal open />
  {/if}

  {#if !isLanding}
    <CommandPalette />
    <KeyboardShortcutsHelp />
  {/if}
{/if}
