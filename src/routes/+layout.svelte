<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import BottomNav from '$lib/components/layout/BottomNav.svelte';
  import MobileHeader from '$lib/components/layout/MobileHeader.svelte';
  import OnboardingModal from '$lib/components/onboarding/OnboardingModal.svelte';
  import PageTransition from '$lib/components/layout/PageTransition.svelte';
  import SideNav from '$lib/components/layout/SideNav.svelte';
  import InstallPrompt from '$lib/components/pwa/InstallPrompt.svelte';
  import OfflineBanner from '$lib/components/pwa/OfflineBanner.svelte';
  import { settingsStore } from '$lib/stores';
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
