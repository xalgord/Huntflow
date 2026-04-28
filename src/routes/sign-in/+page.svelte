<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import AuthShell from '$lib/components/landing/AuthShell.svelte';
  import { clerkAuthStore, mountClerkSignIn } from '$lib/cloud/clerk';
  import { onDestroy, onMount } from 'svelte';

  let mountNode: HTMLDivElement | null = null;
  let unmount: (() => void) | null = null;
  let mounted = false;
  let target = '/dashboard';
  let redirected = false;

  // The auth gate in +layout.svelte sends anonymous visitors here with
  // ?redirect=<originalPath>. Sanitize it (must be a same-origin absolute
  // path) before handing it to Clerk so we never bounce to an external URL.
  function sanitizeRedirect(raw: string | null): string {
    if (!raw) return '/dashboard';
    if (!raw.startsWith('/') || raw.startsWith('//')) return '/dashboard';
    return raw;
  }

  onMount(async () => {
    if (!browser || !mountNode) return;
    target = sanitizeRedirect($page.url.searchParams.get('redirect'));
    // Forward the redirect param across the sign-in <-> sign-up swap so
    // the user keeps their original destination if they switch flows.
    const signUpUrl = target === '/dashboard'
      ? '/sign-up'
      : `/sign-up?redirect=${encodeURIComponent(target)}`;
    unmount = await mountClerkSignIn(mountNode, {
      signUpUrl,
      forceRedirectUrl: target,
      fallbackRedirectUrl: target
    });
    mounted = true;
  });

  onDestroy(() => {
    unmount?.();
  });

  /**
   * Safety-net redirect. Mirror of the equivalent guard on /sign-up.
   * Clerk's embedded mount honors `forceRedirectUrl` for credential
   * sign-ins, but multi-factor flows that bounce through the hosted
   * Frontend API (e.g. magic-link sign-in or social-account first-
   * connect) don't always honor it. Watching the shared auth store
   * means the page navigates the moment Clerk reports a session,
   * regardless of which flow finalized it.
   */
  $: if (browser && !redirected && $clerkAuthStore.signedIn) {
    redirected = true;
    void (async () => {
      try {
        await goto(target, { replaceState: true });
      } catch {
        /* fall through to hard replace below */
      }
      if (browser && window.location.pathname.startsWith('/sign-in')) {
        window.location.replace(target);
      }
    })();
  }
</script>

<svelte:head>
  <title>Sign in &middot; HuntFlow</title>
  <meta name="description" content="Sign in to HuntFlow to enable real-time cloud sync across all your devices." />
  <meta name="robots" content="noindex" />
</svelte:head>

<AuthShell
  title="Welcome back"
  subtitle="Sign in to sync your hunts, notes, evidence and reports across every device."
  footer="sign-in"
>
  {#if !$clerkAuthStore.configured}
    <div class="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
      Sign-in is currently disabled because Clerk is not configured. Set
      <span class="font-mono text-amber-200">VITE_CLERK_PUBLISHABLE_KEY</span> in your environment to enable
      authentication.
    </div>
  {:else if $clerkAuthStore.error}
    <!-- Surface real Clerk failure modes (invalid publishable key, paused
         instance, origin not allowlisted, network blocked) instead of
         hanging on an indefinite spinner. -->
    <div class="space-y-3 rounded-md border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
      <p class="font-medium">Sign-in couldn&apos;t load.</p>
      <p class="text-rose-100/80">{$clerkAuthStore.error}</p>
      <button
        type="button"
        class="inline-flex h-9 items-center rounded-md border border-rose-300/30 bg-rose-500/10 px-3 text-xs font-medium text-rose-100 transition hover:border-rose-200/50 hover:bg-rose-500/20"
        on:click={() => (browser ? window.location.reload() : null)}
      >
        Retry
      </button>
    </div>
  {:else}
    <div bind:this={mountNode} class="hf-clerk-mount" data-mounted={mounted}></div>
    {#if !mounted}
      <div class="flex items-center justify-center py-12 text-sm text-slate-500" aria-live="polite">
        Loading sign-in&hellip;
      </div>
    {/if}
  {/if}
</AuthShell>

<style>
  /* Make sure embedded Clerk components fill the AuthShell card and don't
     re-introduce their own background */
  :global(.hf-clerk-mount) {
    width: 100%;
  }
  :global(.hf-clerk-mount .cl-rootBox),
  :global(.hf-clerk-mount .cl-card) {
    background: transparent !important;
    box-shadow: none !important;
    border: none !important;
    padding: 0 !important;
    width: 100% !important;
  }
</style>
