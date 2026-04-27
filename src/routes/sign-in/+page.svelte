<script lang="ts">
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
      // Stay on /sign-in until the Clerk widget redirects on success. We
      // send authenticated users straight into the app at /dashboard so
      // they don't bounce back to the marketing landing page.
      signUpUrl: '/sign-up',
      forceRedirectUrl: '/dashboard',
      fallbackRedirectUrl: '/dashboard'
    });
    mounted = true;
  });

  onDestroy(() => {
    unmount?.();
  });
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
