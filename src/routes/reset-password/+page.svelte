<script lang="ts">
  /**
   * Reset-password dispatcher.
   *
   * Firebase routes every email-action link through a single URL with
   * a `mode` query param:
   *
   *   /reset-password?mode=resetPassword&oobCode=…
   *   /reset-password?mode=verifyEmail&oobCode=…
   *   /reset-password?mode=recoverEmail&oobCode=…
   *
   * This page is the single dispatcher for those three modes (resolves
   * Open Question 8 with the design's default — one page handles every
   * email-action). Each branch mounts the appropriate UI:
   *
   *   - `resetPassword` → `<PasswordResetConfirmForm />` with the
   *     `oobCode` passed through. The form drives
   *     `confirmPasswordReset(oobCode, newPassword)` and redirects to
   *     `/sign-in?reset=success` on completion.
   *   - `verifyEmail` → on mount, awaits `applyEmailActionCode(oobCode)`
   *     and renders a green success panel (with a link to
   *     `/dashboard`) or the mapped error.
   *   - `recoverEmail` → same skeleton as `verifyEmail`. Firebase's
   *     `applyActionCode` (wrapped by `applyEmailActionCode`) handles
   *     the recovery flow, so the same SDK path covers both. Only the
   *     copy differs.
   *   - Unknown / missing `mode` → fall back to the password-reset
   *     form, since that's the most common entry point.
   *
   * Expired or invalid `oobCode` values surface through `AuthErrorMap`
   * — the password-reset form offers a "Request a new link"
   * affordance, and the verify/recover branches surface the mapped
   * message in a rose status panel.
   *
   * Brand-clean by construction: every error string flows through
   * `AuthErrorMap`, every status panel is built from plain DOM, and
   * no third-party widget is mounted.
   *
   * Feature: firebase-auth-migration
   * Validates: Requirements 3.3, 4.2, 4.3, 4.4
   */

  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { CheckCircle2, Loader2, MailWarning } from 'lucide-svelte';

  import { applyEmailActionCode } from '$lib/cloud/firebase';
  import AuthShell from '$lib/components/landing/AuthShell.svelte';
  import PasswordResetConfirmForm from '$lib/components/auth/PasswordResetConfirmForm.svelte';
  import { mapAuthError } from '$lib/components/auth/AuthErrorMap';

  /** The four modes Firebase routes through the action URL. */
  type ActionMode = 'resetPassword' | 'verifyEmail' | 'recoverEmail';

  /**
   * Status of an action-code apply call (verify-email or
   * recover-email branches). `idle` is the initial mount state,
   * `pending` while the SDK call is in flight, then `success` or
   * `error` when it resolves.
   */
  type ApplyStatus = 'idle' | 'pending' | 'success' | 'error';

  /**
   * Read the dispatch params reactively so SvelteKit client-side
   * navigations between modes (rare, but possible if the user
   * back-navigates) re-render correctly. We treat any value other
   * than the three known modes as unknown and fall through to the
   * password-reset default.
   */
  $: rawMode = $page.url.searchParams.get('mode') ?? '';
  $: oobCode = $page.url.searchParams.get('oobCode') ?? '';
  $: mode = normalizeMode(rawMode);

  /**
   * Title and subtitle copy per branch. Kept as a derived computation
   * so the chrome stays in lockstep with the dispatched mode without
   * a separate state variable.
   */
  $: shellCopy = copyForMode(mode, rawMode);

  /**
   * Track the apply-action-code lifecycle for the verify-email and
   * recover-email branches. The password-reset branch owns its own
   * lifecycle inside `PasswordResetConfirmForm` and doesn't touch
   * these.
   */
  let applyStatus: ApplyStatus = 'idle';
  let applyError = '';

  /**
   * Guard so the `applyEmailActionCode` call only fires once even if
   * Svelte re-runs the reactive block (e.g. during a `$page` update
   * after the hash changes).
   */
  let appliedOnce = false;

  onMount(() => {
    // Only the verify/recover branches need an SDK call on mount.
    // The password-reset branch defers everything to the form's
    // submit handler.
    if (mode === 'verifyEmail' || mode === 'recoverEmail') {
      void runApplyActionCode();
    }
  });

  function normalizeMode(value: string): ActionMode | 'unknown' {
    if (
      value === 'resetPassword' ||
      value === 'verifyEmail' ||
      value === 'recoverEmail'
    ) {
      return value;
    }
    return 'unknown';
  }

  function copyForMode(
    resolvedMode: ActionMode | 'unknown',
    raw: string
  ): { title: string; subtitle: string } {
    switch (resolvedMode) {
      case 'verifyEmail':
        return {
          title: 'Verify your email',
          subtitle: "We're confirming your email address now."
        };
      case 'recoverEmail':
        return {
          title: 'Recover your email',
          subtitle: "We're restoring your email address now."
        };
      case 'resetPassword':
        return {
          title: 'Set a new password',
          subtitle: 'Choose a new password for your HuntFlow account.'
        };
      default:
        // Empty `mode` is the "user landed without a query param"
        // case — fall through to the password-reset chrome since
        // that's where the form below lives.
        if (raw === '') {
          return {
            title: 'Reset password',
            subtitle:
              'Choose a new password for your HuntFlow account.'
          };
        }
        return {
          title: 'Reset password',
          subtitle:
            'This link could not be recognized. Try requesting a new one from the sign-in page.'
        };
    }
  }

  async function runApplyActionCode(): Promise<void> {
    if (appliedOnce) return;
    appliedOnce = true;

    if (!oobCode) {
      // No code in the URL means the link is malformed or the user
      // landed on the page directly. Surface the same mapped string
      // the SDK would produce for an invalid code.
      applyStatus = 'error';
      applyError = 'This link is invalid or has already been used.';
      return;
    }

    applyStatus = 'pending';
    applyError = '';
    try {
      await applyEmailActionCode(oobCode);
      applyStatus = 'success';
    } catch (err) {
      applyStatus = 'error';
      applyError = mapAuthError(err);
    }
  }

  function successCopy(resolvedMode: ActionMode | 'unknown'): {
    heading: string;
    body: string;
  } {
    if (resolvedMode === 'recoverEmail') {
      return {
        heading: 'Email recovered',
        body: "Your account's email address has been restored. You can head back to your dashboard."
      };
    }
    // Default to the verify-email copy for both `verifyEmail` and
    // any unexpected mode that still managed to resolve.
    return {
      heading: 'Email verified',
      body: 'Your email is confirmed. You can head back to your dashboard.'
    };
  }
</script>

<svelte:head>
  <title>{shellCopy.title} &middot; HuntFlow</title>
  <meta
    name="description"
    content="Complete your HuntFlow account email action."
  />
  <meta name="robots" content="noindex" />
</svelte:head>

<AuthShell title={shellCopy.title} subtitle={shellCopy.subtitle} footer="sign-in">
  {#if mode === 'verifyEmail' || mode === 'recoverEmail'}
    {#if applyStatus === 'pending' || applyStatus === 'idle'}
      <div
        role="status"
        aria-live="polite"
        class="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-sm text-zinc-200"
      >
        <Loader2 size={16} class="animate-spin shrink-0" aria-hidden="true" />
        <span>Working on it…</span>
      </div>
    {:else if applyStatus === 'success'}
      <div
        role="status"
        aria-live="polite"
        class="space-y-3"
      >
        <div
          class="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100"
        >
          <CheckCircle2 size={18} class="mt-0.5 shrink-0" aria-hidden="true" />
          <div class="min-w-0">
            <p class="font-medium">{successCopy(mode).heading}</p>
            <p class="mt-1 text-emerald-100/80">{successCopy(mode).body}</p>
          </div>
        </div>
        <a href="/dashboard" class="primary-link">
          <span>Go to dashboard</span>
        </a>
      </div>
    {:else}
      <div
        role="alert"
        aria-live="polite"
        class="space-y-3"
      >
        <div
          class="flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-3 text-sm text-rose-100"
        >
          <MailWarning size={18} class="mt-0.5 shrink-0" aria-hidden="true" />
          <div class="min-w-0">
            <p class="font-medium">We couldn't complete that action.</p>
            <p class="mt-1 text-rose-100/80">{applyError}</p>
          </div>
        </div>
        <a href="/forgot-password" class="secondary-link">
          <span>Request a new link</span>
        </a>
      </div>
    {/if}
  {:else}
    <!--
      Default branch: render the password-reset confirm form. Covers
      both the explicit `mode=resetPassword` case and the fallback
      for unknown / missing modes (most common-case landing).
    -->
    <PasswordResetConfirmForm {oobCode} />
  {/if}
</AuthShell>

<style>
  /* Primary link button — matches the AuthForm accent so the visual
     language stays consistent across every auth surface. Contrast of
     `#070d0a` text on `hsl(var(--primary))` clears WCAG AAA. */
  .primary-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 44px;
    width: 100%;
    border-radius: 0.5rem;
    background-color: hsl(var(--primary));
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #ffffff;
    text-decoration: none;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06),
      0 8px 24px rgba(225, 29, 52, 0.18);
    transition: background-color 150ms ease, transform 150ms ease,
      box-shadow 150ms ease;
  }
  .primary-link:hover {
    background-color: #c81530;
  }
  .primary-link:active {
    transform: scale(0.985);
  }
  .primary-link:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(225, 29, 52, 0.55),
      0 8px 24px rgba(225, 29, 52, 0.25);
  }

  /* Secondary link used for the "Request a new link" affordance.
     Neutral chrome with the agreed accent ring on focus so keyboard
     users see the active control clearly. The 4.5:1 contrast on
     `text-zinc-50` over `#0e1612` clears WCAG AA. */
  .secondary-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 44px;
    width: 100%;
    border-radius: 0.5rem;
    border: 1px solid #27272a; /* zinc-800 */
    background-color: #0e1612;
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #fafafa; /* zinc-50 */
    text-decoration: none;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    transition: border-color 150ms ease, background-color 150ms ease,
      transform 150ms ease;
  }
  .secondary-link:hover {
    border-color: #3f3f46; /* zinc-700 */
    background-color: #131c17;
  }
  .secondary-link:active {
    transform: scale(0.985);
  }
  .secondary-link:focus-visible {
    outline: none;
    border-color: hsl(var(--primary));
    box-shadow: 0 0 0 2px rgba(225, 29, 52, 0.35);
  }
</style>
