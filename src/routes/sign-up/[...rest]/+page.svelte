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
