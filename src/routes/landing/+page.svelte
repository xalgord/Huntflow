<script lang="ts">
  // Back-compat redirect. The marketing landing page used to live at
  // `/landing` but moved to `/` so visitors hitting huntflow.xalgorix.com
  // see the marketing surface first. Anything still pointing at `/landing`
  // (old bookmarks, indexed search results, social shares) lands here and
  // is bounced to the new canonical URL on mount. The link below is the
  // graceful fallback for users with JavaScript disabled.
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    void goto('/', { replaceState: true });
  });
</script>

<svelte:head>
  <title>Redirecting | HuntFlow</title>
  <meta name="robots" content="noindex,follow" />
  <link rel="canonical" href="https://huntflow.xalgorix.com/" />
</svelte:head>

<main class="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-slate-200">
  <div class="max-w-sm">
    <p class="text-sm text-slate-400">Redirecting to the new home page&hellip;</p>
    <a class="mt-3 inline-block text-sm font-medium text-primary-300 underline-offset-4 hover:underline" href="/">
      Continue to HuntFlow
    </a>
  </div>
</main>
