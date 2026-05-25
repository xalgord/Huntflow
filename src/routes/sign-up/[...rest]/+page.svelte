<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { IS_APP } from '$lib/buildTarget';
  import AuthShell from '$lib/components/landing/AuthShell.svelte';
  import { clerkAuthStore, mountClerkSignUp } from '$lib/cloud/clerk';
  import { onDestroy, onMount } from 'svelte';

  let mountNode: HTMLDivElement | null = null;
  let unmount: (() => void) | null = null;
  let mounted = false;
  // Build-mode default — see /sign-up/+page.svelte for context.
  const defaultTarget = IS_APP ? '/dashboard' : '/account';
  let target = defaultTarget;
  // Welcome target with ?welcome=new injected — used by the safety-net
  // redirect below so newly created accounts always trigger onboarding
  // even when the multi-step Clerk flow (email-link verification,
  // SSO callback) lands on /sign-up/[...rest] and bypasses the embedded
  // widget's forceRedirectUrl.
  let welcomeTarget = `${defaultTarget}?welcome=new`;
  // Required for the safety-net reactive block — see /sign-up/+page.svelte.
  let redirected = false;

  function sanitizeRedirect(raw: string | null): string {
    if (!raw) return defaultTarget;
    if (!raw.startsWith('/') || raw.startsWith('//')) return defaultTarget;
    return raw;
  }

  onMount(async () => {
    if (!browser) return;

    // Local-mode short-circuit (see /sign-up/+page.svelte for context).
    if (!$clerkAuthStore.configured) {
      redirected = true;
      try {
        await goto('/account', { replaceState: true });
      } catch {
        /* fall through */
      }
      if (browser && window.location.pathname.startsWith('/sign-up')) {
        window.location.replace('/account');
      }
      return;
    }

    if (!mountNode) return;
    target = sanitizeRedirect($page.url.searchParams.get('redirect'));
    welcomeTarget = `${target}${target.includes('?') ? '&' : '?'}welcome=new`;
    const signInUrl = target === defaultTarget
      ? '/sign-in'
      : `/sign-in?redirect=${encodeURIComponent(target)}`;
    // path: '/sign-up' tells Clerk this widget is in path-routing mode
    // anchored at /sign-up, so it can resume an in-flight OAuth callback
    // landed on /sign-up/sso-callback. Without this, the catch-all mount
    // doesn't recognize the URL state and Clerk falls back to its hosted
    // "after sign-up URL" — typically the marketing landing.
    //
    // forceRedirectUrl/afterSignUpUrl include the welcome=new flag so a
    // freshly created account routes through the onboarding-aware path
    // on /account; the existing-user paths keep the bare target so we
    // don't re-trigger onboarding for returning users.
    unmount = await mountClerkSignUp(mountNode, {
      signInUrl,
      routing: 'path',
      path: '/sign-up',
      forceRedirectUrl: welcomeTarget,
      fallbackRedirectUrl: welcomeTarget
    });
    mounted = true;
  });

  onDestroy(() => {
    unmount?.();
  });

  // Mirror of the safety-net on /sign-up. Catch-all routes mount a fresh
  // SignUp widget for sub-paths like /sign-up/verify-email-address — and
  // when verification finishes, sometimes Clerk doesn't honor the
  // `forceRedirectUrl` because the original redirect param was lost
  // across the email-link round-trip. Watching the auth store guarantees
  // we navigate the moment the session resolves.
  $: if (browser && !redirected && $clerkAuthStore.signedIn) {
    redirected = true;
    void (async () => {
      // Use welcomeTarget so onboarding fires for new accounts even when
      // the email-link round-trip drops the embedded widget's redirect.
      try {
        await goto(welcomeTarget, { replaceState: true });
      } catch {
        /* fall through to hard replace */
      }
      if (browser && window.location.pathname.startsWith('/sign-up')) {
        window.location.replace(welcomeTarget);
      }
    })();
  }
</script>

<svelte:head>
  <title>Create your account &middot; HuntFlow</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<AuthShell title="Create your account" subtitle="Continue signing up." footer="sign-up">
  {#if $clerkAuthStore.configured}
    <div bind:this={mountNode} class="hf-clerk-mount" data-mounted={mounted}></div>
    {#if !mounted}
      <div class="flex items-center justify-center py-12 text-sm text-zinc-500" aria-live="polite">
        Loading sign-up&hellip;
      </div>
    {/if}
  {:else}
    <!-- Local-mode placeholder; the onMount above redirects to /account. -->
    <div class="flex items-center justify-center py-12 text-sm text-zinc-500" aria-live="polite">
      Opening your local workspace&hellip;
    </div>
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
