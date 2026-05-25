<script lang="ts">
  /**
   * Sign-in page.
   *
   * Renders `AuthForm mode="signIn"` inside the shared `AuthShell`
   * chrome. Watches `$authStore.signedIn`; once Firebase reports a
   * signed-in user, the user is redirected to `/dashboard` (with
   * `replaceState: true` so the back button doesn't bounce them
   * back here).
   *
   * Also handles `?reset=success` from the password-reset confirm
   * flow by rendering a non-branded success banner above the form.
   *
   * Feature: firebase-auth-migration
   * Validates: Requirements 1.1, 2.1, 2.2, 10.3
   */

  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { authStore } from '$lib/cloud/firebase';
  import AuthForm from '$lib/components/auth/AuthForm.svelte';
  import AuthShell from '$lib/components/landing/AuthShell.svelte';

  // Guard so the redirect only fires once per signed-in transition.
  // Without it, the reactive block below would re-fire on every
  // store update during the post-sign-in entitlement refresh.
  let redirected = false;

  $: showResetSuccess = $page.url.searchParams.get('reset') === 'success';

  // Watch the auth store: as soon as Firebase reports a signed-in
  // user, send them to the dashboard. `replaceState: true` keeps the
  // sign-in page out of history so the back button works as expected.
  $: if (browser && !redirected && $authStore.signedIn) {
    redirected = true;
    void (async () => {
      try {
        await goto('/dashboard', { replaceState: true });
      } catch {
        // Fall through to a hard replace if the SvelteKit nav fails
        // (e.g. during a partial hydration race).
      }
      if (browser && window.location.pathname.startsWith('/sign-in')) {
        window.location.replace('/dashboard');
      }
    })();
  }
</script>

<svelte:head>
  <title>Sign in &middot; HuntFlow</title>
  <meta
    name="description"
    content="Sign in to HuntFlow to sync your hunts, notes, evidence and reports across every device."
  />
  <meta name="robots" content="noindex" />
</svelte:head>

<AuthShell
  title="Welcome back"
  subtitle="Sign in to sync your hunts, notes, evidence and reports across every device."
  footer="sign-in"
>
  {#if showResetSuccess}
    <div
      role="status"
      aria-live="polite"
      class="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-100"
    >
      Password updated. Sign in with your new credentials.
    </div>
  {/if}

  <AuthForm mode="signIn" />
</AuthShell>
