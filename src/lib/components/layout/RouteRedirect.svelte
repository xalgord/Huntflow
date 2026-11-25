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
    // `to` may carry its own query or #tab; the old URL's query is merged
    // in and its hash only applies when `to` has none.
    const url = new URL(to, location.origin);
    new URLSearchParams(location.search).forEach((value, key) => {
      if (!url.searchParams.has(key)) url.searchParams.set(key, value);
    });
    if (!url.hash && location.hash) url.hash = location.hash;
    void goto(`${url.pathname}${url.search}${url.hash}`, { replaceState: true });
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
