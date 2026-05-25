<script lang="ts">
  /**
   * Sign-up page.
   *
   * Renders `AuthForm mode="signUp"` inside the shared `AuthShell`
   * chrome. Watches `$authStore.signedIn`; once Firebase reports a
   * signed-in user, the user is redirected to `/dashboard?welcome=new`
   * (with `replaceState: true` so the back button doesn't bounce them
   * back here).
   *
   * The `?welcome=new` query param tells `+layout.svelte` to fire the
   * onboarding modal for first-time users, regardless of any stale
   * `onboardingCompleted` value left in IndexedDB from a previous
   * local/demo session on this device. The layout cleans the param
   * back out of the URL via `history.replaceState` once consumed.
   *
   * Feature: firebase-auth-migration
   * Validates: Requirements 1.3, 3.1, 10.3
   */

  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/cloud/firebase';
  import AuthForm from '$lib/components/auth/AuthForm.svelte';
  import AuthShell from '$lib/components/landing/AuthShell.svelte';

  // Destination after a successful sign-up. The `?welcome=new` flag is
  // picked up by `+layout.svelte` to force the onboarding modal for
  // first-time users on this device.
  const welcomeTarget = '/dashboard?welcome=new';

  // Guard so the redirect only fires once per signed-in transition.
  // Without it, the reactive block below would re-fire on every
  // store update during the post-sign-up entitlement refresh.
  let redirected = false;

  // Watch the auth store: as soon as Firebase reports a signed-in
  // user, send them to the dashboard with the welcome flag.
  // `replaceState: true` keeps the sign-up page out of history so the
  // back button works as expected.
  $: if (browser && !redirected && $authStore.signedIn) {
    redirected = true;
    void (async () => {
      try {
        await goto(welcomeTarget, { replaceState: true });
      } catch {
        // Fall through to a hard replace if the SvelteKit nav fails
        // (e.g. during a partial hydration race).
      }
      if (browser && window.location.pathname.startsWith('/sign-up')) {
        window.location.replace(welcomeTarget);
      }
    })();
  }
</script>

<svelte:head>
  <title>Create your account &middot; HuntFlow</title>
  <meta
    name="description"
    content="Create a free HuntFlow workspace. Upgrade to Pro any time to unlock real-time sync across every device."
  />
  <meta name="robots" content="noindex" />
</svelte:head>

<AuthShell
  title="Create your account"
  subtitle="Get a free HuntFlow workspace, then unlock cross-device sync with Pro."
  footer="sign-up"
>
  <AuthForm mode="signUp" />
</AuthShell>
