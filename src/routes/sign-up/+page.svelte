<script lang="ts">
  import { browser } from '$app/environment';
  import AuthShell from '$lib/components/landing/AuthShell.svelte';
  import { clerkAuthStore, mountClerkSignUp } from '$lib/cloud/clerk';
  import { onDestroy, onMount } from 'svelte';

  let mountNode: HTMLDivElement | null = null;
  let unmount: (() => void) | null = null;
  let mounted = false;

  onMount(async () => {
    if (!browser || !mountNode) return;
    unmount = await mountClerkSignUp(mountNode, {
      signInUrl: '/sign-in',
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
  <title>Create your account &middot; HuntFlow</title>
  <meta
    name="description"
    content="Create a free HuntFlow account to enable real-time cloud sync, encrypted backups, and access from any device."
  />
  <meta name="robots" content="noindex" />
</svelte:head>

<AuthShell
  title="Create your account"
  subtitle="Free forever. Upgrade to Pro any time for real-time sync across every device."
  footer="sign-up"
>
  {#if !$clerkAuthStore.configured}
    <div class="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
      Sign-up is currently disabled because Clerk is not configured. Set
      <span class="font-mono text-amber-200">VITE_CLERK_PUBLISHABLE_KEY</span> in your environment to enable
      authentication.
    </div>
  {:else}
    <div bind:this={mountNode} class="hf-clerk-mount" data-mounted={mounted}></div>
    {#if !mounted}
      <div class="flex items-center justify-center py-12 text-sm text-slate-500" aria-live="polite">
        Loading sign-up&hellip;
      </div>
    {/if}
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
