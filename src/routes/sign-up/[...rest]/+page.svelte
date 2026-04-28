<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import AuthShell from '$lib/components/landing/AuthShell.svelte';
  import { clerkAuthStore, mountClerkSignUp } from '$lib/cloud/clerk';
  import { onDestroy, onMount } from 'svelte';

  let mountNode: HTMLDivElement | null = null;
  let unmount: (() => void) | null = null;
  let mounted = false;
  let target = '/account';

  function sanitizeRedirect(raw: string | null): string {
    if (!raw) return '/account';
    if (!raw.startsWith('/') || raw.startsWith('//')) return '/account';
    return raw;
  }

  onMount(async () => {
    if (!browser || !mountNode) return;
    target = sanitizeRedirect($page.url.searchParams.get('redirect'));
    const signInUrl = target === '/account'
      ? '/sign-in'
      : `/sign-in?redirect=${encodeURIComponent(target)}`;
    // path: '/sign-up' tells Clerk this widget is in path-routing mode
    // anchored at /sign-up, so it can resume an in-flight OAuth callback
    // landed on /sign-up/sso-callback. Without this, the catch-all mount
    // doesn't recognize the URL state and Clerk falls back to its hosted
    // "after sign-up URL" — typically the marketing landing.
    unmount = await mountClerkSignUp(mountNode, {
      signInUrl,
      routing: 'path',
      path: '/sign-up',
      forceRedirectUrl: target,
      fallbackRedirectUrl: target,
      afterSignUpUrl: target,
      afterSignInUrl: target
    });
    mounted = true;
  });

  onDestroy(() => {
    unmount?.();
  });

  // Mirror of the safety-net on /sign-up. Catch-all routes mount a fresh
  // SignUp widget for sub-paths like /sign-up/verify-email-address — and
  // when verification finishes, sometimes Clerk doesn't honor the
  // `forceRedirectUrl` because the original redirect param was lost
  // across the email-link round-trip. Watching the auth store guarantees
  // we navigate the moment the session resolves.
  $: if (browser && !redirected && $clerkAuthStore.signedIn) {
    redirected = true;
    void (async () => {
      try {
        await goto(target, { replaceState: true });
      } catch {
        /* fall through to hard replace */
      }
      if (browser && window.location.pathname.startsWith('/sign-up')) {
        window.location.replace(target);
      }
    })();
  }
</script>

<svelte:head>
  <title>Create your account &middot; HuntFlow</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<AuthShell title="Create your account" subtitle="Continue signing up." footer="sign-up">
  {#if $clerkAuthStore.configured}
    <div bind:this={mountNode} class="hf-clerk-mount" data-mounted={mounted}></div>
    {#if !mounted}
      <div class="flex items-center justify-center py-12 text-sm text-slate-500" aria-live="polite">
        Loading sign-up&hellip;
      </div>
    {/if}
  {:else}
    <p class="text-sm text-slate-400">Authentication is not configured.</p>
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
