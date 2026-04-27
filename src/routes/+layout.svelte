<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import BottomNav from '$lib/components/layout/BottomNav.svelte';
  import CommandPalette from '$lib/components/command/CommandPalette.svelte';
  import MobileHeader from '$lib/components/layout/MobileHeader.svelte';
  import OnboardingModal from '$lib/components/onboarding/OnboardingModal.svelte';
  import PageTransition from '$lib/components/layout/PageTransition.svelte';
  import SideNav from '$lib/components/layout/SideNav.svelte';
  import InstallPrompt from '$lib/components/pwa/InstallPrompt.svelte';
  import OfflineBanner from '$lib/components/pwa/OfflineBanner.svelte';
  import { flushAllStores, settingsStore } from '$lib/stores';
  import { commandPaletteStore } from '$lib/stores/commandPaletteStore';
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
    }
  });

  $: pathname = $page.url.pathname;
  $: canonicalUrl = `${$page.url.origin}${pathname}`;
  $: isLanding = pathname === '/landing';
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
{/if}
