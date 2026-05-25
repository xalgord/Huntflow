<script lang="ts">
  // Catch-all for Clerk's multi-step sign-in routes
  // (e.g. /sign-in/factor-one, /sign-in/sso-callback). Same component as
  // the root /sign-in page so the embedded widget can render whichever
  // step Clerk has navigated to.
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { IS_APP } from '$lib/buildTarget';
  import AuthShell from '$lib/components/landing/AuthShell.svelte';
  import { clerkAuthStore, mountClerkSignIn } from '$lib/cloud/clerk';
  import { onDestroy, onMount } from 'svelte';

  let mountNode: HTMLDivElement | null = null;
  let unmount: (() => void) | null = null;
  let mounted = false;
  // Build-mode default redirect — see /sign-in/+page.svelte for context.
  const defaultTarget = IS_APP ? '/dashboard' : '/account';
  let target = defaultTarget;
  // See comment in /sign-in/+page.svelte — this declaration is required
  // for the safety-net reactive block below to compile under strict mode.
  let redirected = false;

  function sanitizeRedirect(raw: string | null): string {
    if (!raw) return defaultTarget;
    if (!raw.startsWith('/') || raw.startsWith('//')) return defaultTarget;
    return raw;
  }

  onMount(async () => {
    if (!browser) return;

    // Local-mode short-circuit (see /sign-in/+page.svelte for context).
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
    const signUpUrl = target === defaultTarget
      ? '/sign-up'
      : `/sign-up?redirect=${encodeURIComponent(target)}`;
    // path: '/sign-in' tells Clerk this widget owns the /sign-in
    // path subtree, so it knows how to resume an in-flight OAuth
    // callback that landed on /sign-in/sso-callback. Without this,
    // the catch-all mount can't recognize the URL state and Clerk
    // falls back to its hosted "after sign-in URL" (typically `/`).
    unmount = await mountClerkSignIn(mountNode, {
      signUpUrl,
      routing: 'path',
      path: '/sign-in',
      forceRedirectUrl: target,
      fallbackRedirectUrl: target
    });
    mounted = true;
  });

  onDestroy(() => {
    unmount?.();
  });

  // Safety-net redirect: navigate the moment Clerk reports a session,
  // independent of which step inside the catch-all flow finalized it.
  $: if (browser && !redirected && $clerkAuthStore.signedIn) {
    redirected = true;
    void (async () => {
      try {
        await goto(target, { replaceState: true });
      } catch {
        /* fall through to hard replace */
      }
      if (browser && window.location.pathname.startsWith('/sign-in')) {
        window.location.replace(target);
      }
    })();
  }
</script>

<svelte:head>
  <title>Sign in &middot; HuntFlow</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<AuthShell title="Welcome back" subtitle="Continue signing in." footer="sign-in">
  {#if $clerkAuthStore.configured}
    <div bind:this={mountNode} class="hf-clerk-mount" data-mounted={mounted}></div>
    {#if !mounted}
      <div class="flex items-center justify-center py-12 text-sm text-zinc-500" aria-live="polite">
        Loading sign-in&hellip;
      </div>
    {/if}
  {:else}
    <!-- Local-mode placeholder; the onMount above redirects to /account. -->
    <div class="flex items-center justify-center py-12 text-sm text-zinc-500" aria-live="polite">
      Opening your local workspace&hellip;
    </div>
  {/if}
</AuthShell>

<style>
  :global(.hf-clerk-mount .cl-rootBox),
  :global(.hf-clerk-mount .cl-card) {
    background: transparent !important;
    box-shadow: none !important;
    border: none !important;
    padding: 0 !important;
    width: 100% !important;
  }
</style>
