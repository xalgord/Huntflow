<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import AuthShell from '$lib/components/landing/AuthShell.svelte';
  import { clerkAuthStore, mountClerkSignUp } from '$lib/cloud/clerk';
  import { onDestroy, onMount } from 'svelte';

  let mountNode: HTMLDivElement | null = null;
  let unmount: (() => void) | null = null;
  let mounted = false;
  let target = '/account';

  function sanitizeRedirect(raw: string | null): string {
    if (!raw) return '/account';
    if (!raw.startsWith('/') || raw.startsWith('//')) return '/account';
    return raw;
  }

  onMount(async () => {
    if (!browser || !mountNode) return;
    target = sanitizeRedirect($page.url.searchParams.get('redirect'));
    const signInUrl = target === '/account'
      ? '/sign-in'
      : `/sign-in?redirect=${encodeURIComponent(target)}`;
    // Append ?welcome=new to the post-signup destination so +layout.svelte
    // can detect a brand-new Clerk account and reliably fire the onboarding
    // modal — regardless of any prior IndexedDB/localStorage state on this
    // device. We only inject the flag on afterSignUpUrl (new accounts) and
    // leave afterSignInUrl pointing at the bare target so existing users
    // returning to /sign-up don't get re-onboarded.
    const welcomeTarget = `${target}${target.includes('?') ? '&' : '?'}welcome=new`;

    unmount = await mountClerkSignUp(mountNode, {
      signInUrl,
      routing: 'path',
      path: '/sign-up',
      forceRedirectUrl: welcomeTarget,
      fallbackRedirectUrl: welcomeTarget,
      afterSignUpUrl: welcomeTarget,
      afterSignInUrl: target
    });
    mounted = true;
  });

  onDestroy(() => {
    unmount?.();
  });

  /**
   * Safety-net redirect. Clerk's embedded mount honors
   * `forceRedirectUrl` for in-app verification (typed OTP) but the
   * hosted email-link verification path doesn't see it — that flow
   * uses the URLs configured in the Clerk Dashboard. To make sign-up
   * always land on the user's intended target, we also watch the
   * shared auth store: the moment Clerk reports a signed-in session
   * we navigate ourselves.
   *
   * `redirected` ensures we don't fire the navigation more than once.
   * If `goto` fails for any reason we fall back to a hard
   * `window.location.replace` so the user never gets stuck on the
   * sign-up page after a successful sign-up.
   */
  $: if (browser && !redirected && $clerkAuthStore.signedIn) {
    redirected = true;
    void (async () => {
      try {
        await goto(target, { replaceState: true });
      } catch {
        /* fall through to hard replace below */
      }
      if (browser && window.location.pathname.startsWith('/sign-up')) {
        window.location.replace(target);
      }
    })();
  }
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
  {:else if $clerkAuthStore.error}
    <!-- Surface real Clerk failure modes (invalid publishable key, paused
         instance, origin not allowlisted, network blocked) instead of
         hanging on an indefinite spinner. -->
    <div class="space-y-3 rounded-md border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
      <p class="font-medium">Sign-up couldn&apos;t load.</p>
      <p class="text-rose-100/80">{$clerkAuthStore.error}</p>
      <button
        type="button"
        class="inline-flex h-9 items-center rounded-md border border-rose-300/30 bg-rose-500/10 px-3 text-xs font-medium text-rose-100 transition hover:border-rose-200/50 hover:bg-rose-500/20"
        on:click={() => (browser ? window.location.reload() : null)}
      >
        Retry
      </button>
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
