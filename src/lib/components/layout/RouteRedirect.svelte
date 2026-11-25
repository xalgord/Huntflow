<script lang="ts">
  /**
   * Client-side redirect for retired routes. Keeps the query string and hash
   * so deep links like `/submissions?target=…` keep working after the screen
   * they pointed at was merged into another one. The hosted site also maps
   * these in static/_redirects; this covers the `npx huntflow` local server.
   */
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  export let to: string;
  export let label = 'the new page';

  onMount(() => {
    void goto(`${to}${location.search}${location.hash}`, { replaceState: true });
  });
</script>

<svelte:head>
  <title>Redirecting | HuntFlow</title>
  <meta name="robots" content="noindex,follow" />
</svelte:head>

<main class="hf-page flex items-center justify-center">
  <p class="text-[0.8125rem] text-zinc-500">
    This screen moved. <a class="hf-link" href={to}>Continue to {label}</a>
  </p>
</main>
