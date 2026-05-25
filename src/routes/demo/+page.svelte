<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { settingsStore } from '$lib/stores';
  import { loadDemoWorkspace } from '$lib/seeds/demoWorkspace';
  import { Crosshair } from 'lucide-svelte';
  import { onMount } from 'svelte';

  // The /demo route hydrates IndexedDB with realistic NeonBank / CloudCart /
  // MeshID sample data via loadDemoWorkspace(), marks onboarding complete so
  // the modal doesn't appear, then navigates to whichever app screen the
  // visitor wanted (defaulting to /timer — the primary in-app surface, since
  // /dashboard is disabled). It's the public entry point recommended for
  // taking marketing screenshots, demos, or first-touch UX.

  let status: 'loading' | 'redirecting' | 'error' = 'loading';
  let errorMessage = '';

  function sanitizeTarget(raw: string | null): string {
    if (!raw) return '/timer';
    if (!raw.startsWith('/') || raw.startsWith('//')) return '/timer';
    // Never bounce back into /demo — that would loop forever.
    if (raw === '/demo' || raw.startsWith('/demo/')) return '/timer';
    return raw;
  }

  onMount(async () => {
    if (!browser) return;
    try {
      // Mark this browser tab as a demo session BEFORE seeding so the
      // auth gate in +layout.svelte lets the user navigate freely between
      // app screens without being bounced to /sign-in. Stored in
      // sessionStorage so it auto-clears when the tab closes — Clerk
      // remains the source of truth for any tab the user opens later.
      try {
        sessionStorage.setItem('huntflow-demo-mode', '1');
      } catch {
        // Private-mode / disabled storage: the demo will still seed
        // IndexedDB, but the auth gate will redirect to /sign-in if Clerk
        // is configured. Surface a clearer error in that case below.
      }

      await loadDemoWorkspace();
      await settingsStore.setValue('onboardingCompleted', true);
      status = 'redirecting';
      const target = sanitizeTarget($page.url.searchParams.get('go'));
      await goto(target, { replaceState: true });
    } catch (caught) {
      console.error('/demo seed failed', caught);
      status = 'error';
      errorMessage = caught instanceof Error ? caught.message : 'Unknown error';
    }
  });
</script>

<svelte:head>
  <title>Loading demo workspace · HuntFlow</title>
  <meta
    name="description"
    content="Spin up a HuntFlow workspace pre-populated with realistic bug bounty sessions, targets, evidence, and submissions."
  />
</svelte:head>

<main
  class="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-300"
  aria-busy={status === 'loading' || status === 'redirecting'}
  aria-live="polite"
>
  <div class="flex max-w-md flex-col items-center gap-4 text-center">
    <span
      class="flex h-12 w-12 items-center justify-center rounded-xl border border-primary-500/30 bg-primary-500/10 text-primary-400"
    >
      <Crosshair size={22} aria-hidden="true" />
    </span>

    {#if status === 'loading'}
      <p class="text-sm font-medium text-zinc-100">Loading demo workspace…</p>
      <p class="text-xs text-zinc-500">
        Seeding realistic targets, sessions, notes, evidence, and payouts so every screen has data.
      </p>
    {:else if status === 'redirecting'}
      <p class="text-sm font-medium text-zinc-100">Workspace ready. Opening the app…</p>
    {:else}
      <p class="text-sm font-medium text-rose-300">Couldn&apos;t seed the demo workspace.</p>
      <p class="text-xs text-zinc-500">{errorMessage}</p>
      <a
        href="/"
        class="mt-2 inline-flex min-h-[36px] items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
      >
        Back to landing
      </a>
    {/if}
  </div>
</main>
