# Runbook — Cutover Smoke Checklist

Operator-facing checklist mirroring `design.md` → "Cutover Playbook"
step 10. Each item is a checkbox the operator marks off **after** the new
bundle is live on `https://huntflow.xalgorix.com` and **before**
`runbook-cutover.md` step 11 (the Dodo test → live switch).

The checklist is run end-to-end in a single browser session in **incognito
mode**, so cached service workers, cookies, or IndexedDB from a previous
session don't mask the result.

The checklist exists to validate Requirements 1, 2, 3, 4, 5, 6, 7, 8, and
11 against the deployed production bundle.

---

## Pre-flight

- [ ] **Open `https://huntflow.xalgorix.com` in an incognito window.**
  - Expected result: the new AuthUI loads. The landing page renders the
    HuntFlow zinc-950 chrome with a green primary action.
  - Failure indicates: the deploy didn't go through, or the service worker
    is serving stale assets. Hard-reload (Cmd-Shift-R / Ctrl-Shift-R).
- [ ] **DevTools → Network → search for `clerk`. Expect zero matches.**
  - Failure indicates: a stale bundle or stale cache. Bump the
    service-worker `CACHE` constant if not already bumped, or clear
    site data and reload.

---

## 1. Email + password sign-in
**Validates: Requirement 1.1, 6.1, 6.2**

- [ ] Navigate to `/sign-in`.
- [ ] Enter the email and password of a Firebase user that already exists
      in the new prod project (create a throwaway one in advance via
      `/sign-up` if needed).
- [ ] Submit.
  - Expected result: the page redirects to `/dashboard`.
  - The header shows the user's email or display name.
  - DevTools → Application → IndexedDB shows the Convex client populated.
  - Failure indicates: Firebase auth misconfigured (Step 2 of
    `runbook-firebase.md`), or the Convex `auth.config.ts` issuer is
    wrong (`runbook-convex-env.md` `FIREBASE_PROJECT_ID` mismatch).

---

## 2. Google OAuth sign-in
**Validates: Requirement 2.1, 6.1**

- [ ] From `/sign-in`, click the **Continue with Google** button.
- [ ] Complete the Google consent screen.
  - Expected result: redirect to `/dashboard`, signed in.
  - Failure indicates: Google provider disabled in Firebase
    (`runbook-firebase.md` Step 2b), or `huntflow.xalgorix.com` is missing
    from Authorized Domains (Step 3).

---

## 3. GitHub OAuth sign-in
**Validates: Requirement 2.2, 6.1**

- [ ] Sign out (header → Sign out).
- [ ] From `/sign-in`, click **Continue with GitHub**.
- [ ] Complete the GitHub consent screen.
  - Expected result: redirect to `/dashboard`, signed in.
  - Failure indicates: GitHub OAuth client mis-configured (callback URL
    must be `https://<projectId>.firebaseapp.com/__/auth/handler`), or
    GitHub provider disabled in Firebase.

---

## 4. Sign-up + verification email
**Validates: Requirement 1.3, 3.1, 3.2, 3.4*

- [ ] Sign out.
- [ ] Navigate to `/sign-up`.
- [ ] Enter a fresh email address (use `+suffix` aliases for testing).
- [ ] Enter a password that satisfies the password policy (≥ 8 chars,
      contains a letter and a digit).
- [ ] Submit.
  - Expected result: redirect to `/dashboard`. The
    `EmailVerificationBanner` shows "Verify your email" with a Resend
    button.
  - A verification email arrives at the test inbox within ~30s. Subject:
    `Verify your email for HuntFlow`. Link points at
    `https://huntflow.xalgorix.com/reset-password?mode=verifyEmail&oobCode=…`.
  - Click the link. The page confirms verification.
  - Reload `/account`. The verification banner disappears.
  - Failure indicates: email templates not edited in
    `runbook-firebase.md` Step 5, or action URL not pointing at
    `/reset-password`.

---

## 5. Password reset
**Validates: Requirement 4.1, 4.2, 4.3*

- [ ] Sign out.
- [ ] Navigate to `/forgot-password`.
- [ ] Enter the email of an existing password user.
- [ ] Submit.
  - Expected result: a non-branded "Check your inbox" message renders.
  - A password-reset email arrives within ~30s. Subject:
    `Reset your HuntFlow password`. Link points at
    `https://huntflow.xalgorix.com/reset-password?mode=resetPassword&oobCode=…`.
- [ ] Click the link. Enter a new password. Submit.
  - Expected result: redirect to `/sign-in` with a non-branded success
    message. Sign in with the new password works.
  - Failure indicates: password policy too strict for the chosen new
    password, or `oobCode` expired (links expire after 1 hour by default).

---

## 6. OfflineMode entry from landing page
**Validates: Requirement 11.1, 11.3*

- [ ] Open a new incognito window.
- [ ] DevTools → Network → set throttling to **Offline**.
- [ ] Load `https://huntflow.xalgorix.com`.
- [ ] On the landing page, click **Continue without signing in** (or the
      equivalent local-mode entry).
  - Expected result: the dashboard loads. Creating sessions / notes /
    targets / payouts persists to IndexedDB. No Convex mutation is
    issued (Network tab stays empty).
  - The AuthUI shows a non-branded "You're offline — sign-in unavailable"
    message if any sign-in surface is exercised.
  - Failure indicates: the service worker isn't caching the offline
    bundle, or the gating predicate in `realtimeSync.ts` is wrong.
- [ ] Restore network throttling to **No throttling** before continuing.

---

## 7. Convex authenticated read
**Validates: Requirement 6.2, 6.3, 6.5*

- [ ] Sign back in (any provider).
- [ ] Navigate to `/settings`.
- [ ] Trigger a manual sync (the existing **Sync now** action on the
      Settings page).
  - Expected result: the sync completes without error. DevTools →
    Network shows a Convex WebSocket frame carrying the Firebase ID token
    in its auth handshake.
  - Settings page status text shows the new Firebase-equivalent
    "Signed in" / "Convex auth" strings (the regex updated in task 6.2).
  - Failure indicates: `convex/auth.config.ts` issuer mismatch, or the
    Firebase project ID set in Convex env doesn't match the one minting
    the client tokens.

---

## 8. Pro entitlement via test-mode Dodo webhook
**Validates: Requirement 7.1, 7.4, 7.5, 8.1, 8.2*

- [ ] On the same signed-in session, navigate to `/pricing`.
- [ ] Click **Upgrade to Pro**.
  - Expected result: redirect to a Dodo Payments **test mode** checkout
    page. The product is `HuntFlow Pro`.
- [ ] Complete the checkout using a Dodo test card.
  - Expected result: redirect back to `/account?upgrade=success`.
  - Within ~2 seconds, `authStore.isPro` flips to `true` (the
    SubscriptionCard re-renders to show **Manage subscription**, and the
    realtime sync indicator goes from idle to active).
  - The Convex `entitlements` table contains a row keyed by the user's
    uid with `isPro = true`, a populated `dodoCustomerId`, and a non-null
    `currentPeriodEnd`.
  - Failure indicates: webhook URL misconfigured in Dodo dashboard
    (`runbook-dodo.md` Step 4), webhook signing secret mismatch
    (`runbook-convex-env.md` `DODO_WEBHOOK_SIGNING_SECRET`), or
    `metadata.uid` not propagating from `createCheckoutSession`.

---

## 9. Manage subscription redirect
**Validates: Requirement 8.3*

- [ ] On `/account`, click **Manage subscription**.
  - Expected result: redirect to a Dodo Payments customer-portal URL.
    The portal lists the active HuntFlow Pro subscription.
  - Failure indicates: `dodoCustomerId` empty on the entitlement row
    (webhook didn't populate it), or `getCustomerPortalUrl` returned an
    error (check Convex logs).

---

## 10. Account deletion with re-auth prompt
**Validates: Requirement 5.3, 5.4, 6.4, 6.5*

Use a throwaway test account, not the operator's daily-driver account.

- [ ] Navigate to `/account`.
- [ ] In the **Delete account** card, click **Delete**.
  - Expected result: the two-step confirmation modal renders the copy
    `This will permanently delete your account and all your cloud data.
    This cannot be undone.`
- [ ] Confirm.
  - Expected result: the AuthUI prompts for re-authentication
    (password reprompt for password users, OAuth re-popup for Google /
    GitHub users).
- [ ] Complete re-auth.
  - Expected result: the Firebase user is deleted, the Convex
    `syncItems` / `assetFiles` / `assetUploadTickets` rows for that uid
    are removed, the realtime sync engine stops, the Convex auth binding
    is cleared, and the browser redirects to `/`.
  - Subsequent attempts to query Convex return `Unauthenticated`
    (Property 7).
  - Failure indicates: re-auth flow not wired through `AccountDeleteCard`,
    or `deleteAccount()` in `firebase.ts` isn't running the Convex teardown.

---

## Sign-off

- [ ] All ten checklist items above pass.
- [ ] DevTools → Console shows no red errors during any of the above flows.
- [ ] Convex dashboard → Logs shows no auth-validation failures during
      the smoke run.

If every box is checked, proceed to `runbook-cutover.md` step 11
(Dodo test → live switch).

If any box fails, follow the relevant rollback step in
`runbook-cutover.md` → "Rollback Playbook" before retrying.
