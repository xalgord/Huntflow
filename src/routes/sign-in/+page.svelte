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
  let target = '/account';
  // Guard for the safety-net redirect below — without this declaration
  // Svelte's strict-mode reactive block would throw `redirected is not
  // defined`, leaving the user stuck on /sign-in after Clerk reports a
  // session and triggering the loop where the landing page bounces back
  // here.
  let redirected = false;

  // The auth gate in +layout.svelte sends anonymous visitors here with
  // ?redirect=<originalPath>. Sanitize it (must be a same-origin absolute
  // path) before handing it to Clerk so we never bounce to an external URL.
  function sanitizeRedirect(raw: string | null): string {
    if (!raw) return '/account';
    if (!raw.startsWith('/') || raw.startsWith('//')) return '/account';
    return raw;
  }

  onMount(async () => {
    if (!browser) return;

    // Local-mode short-circuit. Without a Clerk publishable key in the
    // build, this app is running privately on the user's machine
    // (npx/npm install). Sign-in doesn't apply — bounce to /account,
    // which renders a local-workspace view in that mode.
    if (!$clerkAuthStore.configured) {
      redirected = true;
      try {
        await goto('/account', { replaceState: true });
      } catch {
        /* fall through */
      }
      if (browser && window.location.pathname.startsWith('/sign-in')) {
        window.location.replace('/account');
      }
      return;
    }

    if (!mountNode) return;
    target = sanitizeRedirect($page.url.searchParams.get('redirect'));
    // Forward the redirect param across the sign-in <-> sign-up swap so
    // the user keeps their original destination if they switch flows.
    const signUpUrl = target === '/account'
      ? '/sign-up'
      : `/sign-up?redirect=${encodeURIComponent(target)}`;
    // Path-based routing: Clerk's multi-step flow (factor-one,
    // sso-callback, verify-email) navigates to real URLs that hit our
    // catch-all `/sign-in/[...rest]/+page.svelte` route. Virtual mode
    // (the previous default here) leaves OAuth callbacks stranded on
    // `/sign-in/sso-callback` with no widget to resume them, so Clerk
    // falls back to its hosted "after sign-in URL" — typically `/`,
    // the marketing landing. Path routing keeps the flow inside our
    // chrome and honors `forceRedirectUrl: target`.
    unmount = await mountClerkSignIn(mountNode, {
      signUpUrl,
      routing: 'path',
      path: '/sign-in',
      forceRedirectUrl: target,
      fallbackRedirectUrl: target,
      afterSignInUrl: target,
      afterSignUpUrl: target
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
    <!-- Local-mode placeholder. The onMount above is already navigating
         the user to /account; this just keeps the visual frame stable
         during the brief bounce so they don't see a flash of error UI. -->
    <div class="flex items-center justify-center py-12 text-sm text-slate-500" aria-live="polite">
      Opening your local workspace&hellip;
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
