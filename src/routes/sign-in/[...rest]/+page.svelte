<script lang="ts">
  // Catch-all for Clerk's multi-step sign-in routes
  // (e.g. /sign-in/factor-one, /sign-in/sso-callback). Same component as
  // the root /sign-in page so the embedded widget can render whichever
  // step Clerk has navigated to.
  import { browser } from '$app/environment';
  import AuthShell from '$lib/components/landing/AuthShell.svelte';
  import { clerkAuthStore, mountClerkSignIn } from '$lib/cloud/clerk';
  import { onDestroy, onMount } from 'svelte';

  let mountNode: HTMLDivElement | null = null;
  let unmount: (() => void) | null = null;
  let mounted = false;

  onMount(async () => {
    if (!browser || !mountNode) return;
    unmount = await mountClerkSignIn(mountNode, {
      signUpUrl: '/sign-up',
      forceRedirectUrl: '/',
      fallbackRedirectUrl: '/'
    });
    mounted = true;
  });

  onDestroy(() => {
    unmount?.();
  });
</script>

<svelte:head>
  <title>Sign in &middot; HuntFlow</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<AuthShell title="Welcome back" subtitle="Continue signing in." footer="sign-in">
  {#if $clerkAuthStore.configured}
    <div bind:this={mountNode} class="hf-clerk-mount" data-mounted={mounted}></div>
    {#if !mounted}
      <div class="flex items-center justify-center py-12 text-sm text-slate-500" aria-live="polite">
        Loading sign-in&hellip;
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
