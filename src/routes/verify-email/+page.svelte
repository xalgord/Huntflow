<script lang="ts">
  /**
   * Verify-email redirect.
   *
   * Per OQ 8 default in design.md, the canonical email-action handler
   * lives at /reset-password (single-page dispatcher on `?mode=…`).
   * This route is kept as a thin redirect for any link or bookmark
   * that points at /verify-email directly: it forwards the entire
   * query string (which includes `oobCode` and `mode=verifyEmail`)
   * onto the dispatcher.
   *
   * Feature: firebase-auth-migration
   * Validates: Requirement 3.3
   */

  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  onMount(() => {
    if (!browser) return;
    // Preserve any query params, and force `mode=verifyEmail` if it
    // isn't already set so the dispatcher routes to the right branch
    // even for legacy links that omit the mode param.
    const params = new URLSearchParams($page.url.searchParams);
    if (!params.has('mode')) params.set('mode', 'verifyEmail');
    const target = `/reset-password?${params.toString()}`;
    void goto(target, { replaceState: true });
  });
</script>

<svelte:head>
  <title>Verify email &middot; HuntFlow</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main
  class="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-sm text-zinc-400"
  aria-busy="true"
  aria-live="polite"
>
  Verifying your email&hellip;
</main>
