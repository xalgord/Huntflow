<script lang="ts">
  // Lightweight wrapper around Clerk's `<UserButton />` so any page can
  // drop the profile avatar + sign-out menu in with a single line:
  //
  //     <UserMenu />
  //
  // Clerk renders the avatar + dropdown directly into the host node, so
  // we just bind a div, await `mountClerkUserButton`, and unmount on
  // teardown. The cleanup function returned by `mountClerkUserButton`
  // is captured even if the component unmounts before mount finishes
  // resolving, to avoid leaking handlers.
  import { onDestroy, onMount } from 'svelte';
  import { mountClerkUserButton } from '$lib/cloud/clerk';

  let node: HTMLDivElement;
  let cleanup: (() => void) | null = null;
  let cancelled = false;

  onMount(async () => {
    if (!node) return;
    const dispose = await mountClerkUserButton(node);
    if (cancelled) {
      dispose();
      return;
    }
    cleanup = dispose;
  });

  onDestroy(() => {
    cancelled = true;
    cleanup?.();
  });
</script>

<div bind:this={node} class="flex h-9 items-center" aria-label="Account menu"></div>
