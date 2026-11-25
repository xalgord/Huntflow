<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  // Stats now live in Analytics → Activity.
  onMount(() => {
    void goto('/analytics?view=activity', { replaceState: true });
  });
</script>

<svelte:head>
  <title>Redirecting | HuntFlow</title>
  <meta name="robots" content="noindex,follow" />
</svelte:head>

<main class="hf-page flex items-center justify-center">
  <p class="text-[0.8125rem] text-zinc-500">
    Stats moved. <a class="hf-link" href="/analytics?view=activity">Continue to Analytics</a>
  </p>
</main>
