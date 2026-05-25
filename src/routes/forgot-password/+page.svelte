<script lang="ts">
  /**
   * Forgot-password page.
   *
   * Renders `PasswordResetRequestForm` inside the shared `AuthShell`
   * chrome. The form drives the `sendPasswordReset` SDK call and
   * surfaces a non-branded success notice on completion.
   *
   * `footer="sign-in"` keeps the "Don't have an account? Sign up"
   * link in place so users who landed here by mistake have a fast
   * path to create an account.
   *
   * Feature: firebase-auth-migration
   * Validates: Requirement 4.1
   */

  import AuthShell from '$lib/components/landing/AuthShell.svelte';
  import PasswordResetRequestForm from '$lib/components/auth/PasswordResetRequestForm.svelte';
</script>

<svelte:head>
  <title>Reset password &middot; HuntFlow</title>
  <meta
    name="description"
    content="Request a password reset link for your HuntFlow account."
  />
  <meta name="robots" content="noindex" />
</svelte:head>

<AuthShell
  title="Reset your password"
  subtitle="Enter the email tied to your HuntFlow account and we'll send a reset link."
  footer="sign-in"
>
  <PasswordResetRequestForm />
</AuthShell>
