# Runbook — Cutover and Rollback Playbook

Operator-facing playbook consolidating `design.md` → "Cutover Playbook"
(12 steps) and "Rollback Playbook" into a single sequenced document.
The agent does **not** execute these steps; the operator does.

This is the master runbook for the cutover release. Every other Wave 7
runbook is referenced from it:

- Provision Firebase: [`runbook-firebase.md`](./runbook-firebase.md).
- Provision Dodo: [`runbook-dodo.md`](./runbook-dodo.md).
- Set Convex env vars: [`runbook-convex-env.md`](./runbook-convex-env.md).
- Smoke checklist: [`runbook-cutover-smoke.md`](./runbook-cutover-smoke.md).

Cutover is a **hard cutover** for a greenfield app: no production users,
no Clerk → Firebase user export, no dual-stack auth window. The
cutover flips Convex's auth provider, wipes any pre-cutover Convex rows
keyed by the old Clerk-derived `ownerId`, and brings up the Firebase
AuthUI in one shot.

---

## Pre-cutover gate

Before starting the cutover, confirm:

- [ ] The PR containing all code changes for this migration has been
      reviewed and approved.
- [ ] CI is green on the PR branch (build, unit, property, e2e suites).
- [ ] `runbook-firebase.md` has been completed for the prod Firebase
      project. The four `VITE_FIREBASE_*` values and `FIREBASE_PROJECT_ID`
      are in hand.
- [ ] `runbook-dodo.md` Steps 1 – 5 have been completed in **test mode**
      against the prod Convex deployment slug. The four `DODO_*` test-mode
      values are in hand.
- [ ] An incognito browser window is ready for the smoke checklist.
- [ ] The operator has CLI access to run `npx convex deploy`,
      `npx convex env`, and `npx convex run` against the prod deployment.
- [ ] The operator has admin access to the Vercel project to update env
      vars and trigger / promote deploys.
- [ ] The operator has identified the **last pre-cutover commit SHA** on
      `main`. Record it here for rollback:

      Pre-cutover SHA: `__________________`

---

## Cutover Playbook

### Step 1 — Open the PR

- [ ] PR is opened against `main`.
- [ ] PR description links to `design.md` and to this runbook.
- [ ] PR description includes a checklist mirroring the steps below.

**Before**: pre-cutover code on `main`, Clerk-based AuthUI live.
**After**: PR awaiting merge, no production change.
**Rollback note**: closing the PR is a no-op.

---

### Step 2 — Provision Firebase

Follow [`runbook-firebase.md`](./runbook-firebase.md) end-to-end against
the prod Firebase project.

Captured values:

- `VITE_FIREBASE_API_KEY = __________________`
- `VITE_FIREBASE_AUTH_DOMAIN = __________________`
- `VITE_FIREBASE_PROJECT_ID = __________________`
- `VITE_FIREBASE_APP_ID = __________________`
- `FIREBASE_PROJECT_ID = __________________` (same string as `projectId`)

**Before**: no Firebase project for HuntFlow Auth.
**After**: Firebase project provisioned with Email/Password + Google +
GitHub providers, authorized domains, password policy, and email
templates. **No production traffic affected.**
**Rollback note**: deleting the Firebase project is reversible up to
30 days from the GCP console.

---

### Step 3 — Provision Dodo (test mode)

Follow [`runbook-dodo.md`](./runbook-dodo.md) Steps 1 – 5 against the
**prod Convex deployment slug**. The webhook URL for prod is

```
https://<prod-convex-slug>.convex.site/dodo-webhook
```

Captured values (test mode):

- `DODO_API_BASE_URL = https://test.dodopayments.com`
- `DODO_API_KEY = __________________`
- `DODO_WEBHOOK_SIGNING_SECRET = __________________`
- `DODO_PRO_PRODUCT_ID = __________________`

**Before**: no Dodo product / webhook for HuntFlow.
**After**: HuntFlow Pro product created in test mode; webhook registered
pointing at the prod Convex deployment with the five subscription event
types subscribed.
**Rollback note**: webhooks and products can be deleted from the Dodo
dashboard with no side effects.

---

### Step 4 — Local dev verify

Run the migration end-to-end against a local dev Convex deployment using
a dev Firebase project (separate from prod).

```bash
# Set Firebase client env
echo 'VITE_FIREBASE_API_KEY=…'      >> .env.local
echo 'VITE_FIREBASE_AUTH_DOMAIN=…'  >> .env.local
echo 'VITE_FIREBASE_PROJECT_ID=…'   >> .env.local
echo 'VITE_FIREBASE_APP_ID=…'       >> .env.local

# Set Convex server env (dev) — see runbook-convex-env.md Step 2
npx convex env set FIREBASE_PROJECT_ID            <id>
npx convex env set DODO_API_BASE_URL              https://test.dodopayments.com
npx convex env set DODO_API_KEY                   <test-key>
npx convex env set DODO_WEBHOOK_SIGNING_SECRET    <test-secret>
npx convex env set DODO_PRO_PRODUCT_ID            <test-product-id>

# Run dev
npx convex dev
npm run dev
```

Verify:

- [ ] Sign-up + email verification works against the dev Firebase project.
- [ ] Sign-in (email, Google, GitHub) works.
- [ ] Password reset email arrives and the flow completes.
- [ ] A Dodo test webhook (triggered from the Dodo dashboard test
      panel) flips an `entitlements` row in the dev Convex deployment.
- [ ] A Dodo test checkout completes and `isPro` flips in the local UI.

**Before**: local app on Clerk.
**After**: local app on Firebase + Dodo, end-to-end verified.
**Rollback note**: revert `.env.local` and re-run dev. No prod impact.

---

### Step 5 — Set prod Convex env (test-mode Dodo values)

Follow [`runbook-convex-env.md`](./runbook-convex-env.md) Step 3.

```bash
npx convex env --prod set FIREBASE_PROJECT_ID            <id>
npx convex env --prod set DODO_API_BASE_URL              https://test.dodopayments.com
npx convex env --prod set DODO_API_KEY                   <test-key>
npx convex env --prod set DODO_WEBHOOK_SIGNING_SECRET    <test-secret>
npx convex env --prod set DODO_PRO_PRODUCT_ID            <test-product-id>
```

Then verify with `runbook-convex-env.md` Step 5a.

**Do not** unset `CLERK_JWT_ISSUER_DOMAIN` here — the prod deployment is
still running the pre-cutover code that reads it. Cleanup is in Step 12.

**Before**: prod Convex env contains only `CLERK_JWT_ISSUER_DOMAIN` (and
unrelated vars).
**After**: prod Convex env contains the five new vars **plus** the still-needed
`CLERK_JWT_ISSUER_DOMAIN`. The currently-deployed code still references
the Clerk var; the new vars are dormant until Step 6 deploys.
**Rollback note**: `npx convex env --prod unset <NAME>` removes any var
without redeploy. Reversible.

---

### Step 6 — Convex deploy (auth.config + schema + http router)

```bash
npx convex deploy
```

Expected output: `convex deploy` reports success and lists the deployed
modules (`entitlements`, `dodo`, `http`, plus the existing `sync`).

**This is the moment Convex flips its auth provider.** From this point
on:

- Convex validates Firebase ID tokens.
- Convex rejects Clerk tokens with `Unauthenticated`.
- The frontend on `huntflow.xalgorix.com` is still the old Clerk-based
  bundle, which is now broken in production.

The window between Step 6 and Step 8 is the **cutover blackout**. Keep
it as short as possible — ideally under five minutes. Operator should
have Step 7 and Step 8 staged and ready before triggering Step 6.

**Before**: Convex validating Clerk tokens; old bundle works.
**After**: Convex validating Firebase tokens; old bundle's Convex
calls fail with `Unauthenticated`. New bundle not yet deployed.
**Rollback note**: see Rollback Playbook → "Rollback A". The previous
Convex commit can be redeployed in seconds.

---

### Step 7 — Update Vercel env vars

In the Vercel project settings (Project → Settings → Environment Variables),
for the **Production** environment:

- [ ] Add `VITE_FIREBASE_API_KEY` with the value from Step 2.
- [ ] Add `VITE_FIREBASE_AUTH_DOMAIN`.
- [ ] Add `VITE_FIREBASE_PROJECT_ID`.
- [ ] Add `VITE_FIREBASE_APP_ID`.
- [ ] Remove every `VITE_CLERK_*` and `NEXT_PUBLIC_CLERK_*` entry.
- [ ] Remove `CLERK_SECRET_KEY` if it was set.

Do **not** trigger a deploy from this screen — the deploy happens by
merging the PR in Step 8.

**Before**: Vercel env contains Clerk client vars.
**After**: Vercel env contains Firebase client vars; Clerk vars removed.
The currently-running deployment still has the old env vars baked into
its bundle (env is captured at build time), so this change has no
runtime effect until the next deploy.
**Rollback note**: re-add the Clerk vars from a previous deploy's env
snapshot if rollback is needed. Vercel preserves env-var change history.

---

### Step 8 — Vercel deploy (merge PR)

- [ ] Merge the PR into `main`.
- [ ] Vercel auto-deploys on push to `main`.
- [ ] Wait for the deploy to reach **Ready** status in the Vercel
      dashboard.

The cutover blackout (Step 6 → Step 8) ends here.

**Before**: prod serving the old Clerk bundle, broken because Convex
already flipped in Step 6.
**After**: prod serving the new Firebase + Dodo bundle. Service worker
`CACHE` constant bumped to `huntflow-command-center-v3`, so returning
clients pick up the new bundle on first reload.
**Rollback note**: see Rollback Playbook → "Rollback B". Vercel
deployments → previous release → **Promote to Production** restores the
old bundle in seconds.

---

### Step 9 — One-time data wipe

Wipe any `syncItems`, `assetFiles`, `assetUploadTickets` rows whose
`ownerId` was issued under the old Clerk identity. There are no
production users, so this empties tables that contained pre-cutover dev
or test data only.

**This requires the Convex prod deployment to be configured first** —
both `FIREBASE_PROJECT_ID` (Step 5) and the deploy of the new code
(Step 6) must already have happened. Without those, the wipe mutation
won't be deployed yet.

The function key is exported from `convex/entitlements.ts` as
`wipeLegacyOwnerData`. Run:

```bash
npx convex run --prod entitlements:wipeLegacyOwnerData
```

Expected output: a JSON object of the form `{ "deleted": <n> }` where
`<n>` is the total number of rows removed across the three tables.

**Before**: tables contain rows keyed by old Clerk-derived ownerIds.
**After**: tables empty (or near-empty). The new `entitlements` table
remains untouched — the wipe does not reset entitlements.
**Rollback note**: irreversible — the wipe permanently deletes rows.
This is acceptable because there are no production users (Requirement
6.6 / 13.4). If rollback B (revert Vercel deploy) is invoked **after**
this step, the rolled-back bundle will start with empty Convex tables;
that matches its pre-cutover state for a greenfield app.

---

### Step 10 — Smoke checklist

Run the full smoke checklist in [`runbook-cutover-smoke.md`](./runbook-cutover-smoke.md).

- [ ] All ten smoke items pass.

If any item fails, follow the rollback path described in the Rollback
Playbook section below before retrying.

**Before**: new bundle live but unverified.
**After**: new bundle verified end-to-end against test-mode Dodo. Safe
to flip Dodo to live mode.
**Rollback note**: smoke failures are the primary trigger for Rollback B.

---

### Step 11 — Switch Dodo to live mode

Follow [`runbook-dodo.md`](./runbook-dodo.md) Step 6 to provision the
HuntFlow Pro product, API key, and webhook in **live mode**. Then update
prod Convex env per [`runbook-convex-env.md`](./runbook-convex-env.md)
Step 4:

```bash
npx convex env --prod set DODO_API_BASE_URL              https://live.dodopayments.com
npx convex env --prod set DODO_API_KEY                   <live-key>
npx convex env --prod set DODO_WEBHOOK_SIGNING_SECRET    <live-secret>
npx convex env --prod set DODO_PRO_PRODUCT_ID            <live-product-id>
```

No code change or redeploy required — Convex env updates take effect on
the next request.

Verify with one live test purchase using a real card the operator
controls (refund through the customer portal afterwards).

**Before**: Convex talks to Dodo test mode; checkouts charge nothing real.
**After**: Convex talks to Dodo live mode; real charges are possible.
**Rollback note**: setting `DODO_API_BASE_URL` back to
`https://test.dodopayments.com` reverts to test mode without redeploy.

---

### Step 12 — Final cleanup

- [ ] Verify Vercel and Convex prod logs show no Clerk traffic and no
      auth-validation failures over the past 24 hours.
- [ ] Delete the Clerk project from the Clerk dashboard.

Optional cosmetic cleanup of the now-unused Convex env var:

```bash
npx convex env --prod unset CLERK_JWT_ISSUER_DOMAIN
```

**Before**: Clerk project still exists; `CLERK_JWT_ISSUER_DOMAIN` still
set in Convex env (but no code reads it).
**After**: Clerk project deleted; Convex env clean.
**Rollback note**: deleting the Clerk project is **the point of no return
for Rollback C** (re-set `CLERK_JWT_ISSUER_DOMAIN`). Run Step 10's smoke
checklist successfully **before** running Step 12.

---

## Rollback Playbook

The cutover is rollback-safe by design. The new `entitlements` table is
purely additive — adding it doesn't break any existing read or write
path on the pre-cutover code. Rolling back the Vercel deploy plus the
Convex commit plus re-setting `CLERK_JWT_ISSUER_DOMAIN` is sufficient
to restore the pre-cutover behaviour, because the dormant `entitlements`
table is invisible to the rolled-back bundle.

The data wipe in Step 9 is destructive and irreversible. That is
acceptable because there are no production users, and the rolled-back
bundle starts with empty per-user tables anyway (greenfield).

### Rollback A — Convex auth flip went bad (between Step 6 and Step 8)

If `npx convex deploy` succeeds but the new Vercel deploy hasn't
completed (Step 8) and the cutover blackout is taking too long:

1. Redeploy the previous Convex commit:

   ```bash
   git checkout <pre-cutover-sha>
   npx convex deploy
   ```

2. Convex re-flips back to validating Clerk tokens.
3. The old Vercel bundle (still live) starts working again.
4. The new `entitlements` table remains in the schema. The pre-cutover
   code does not read it; it is dormant. **Leave it in place** — it
   does not break anything and saves redoing the schema migration on
   the next cutover attempt.

### Rollback B — Smoke checklist failed (after Step 8)

If the smoke checklist fails after the new Vercel bundle is live:

1. **Revert the Vercel deploy**: Vercel → Deployments → previous
   release → **Promote to Production**. This restores the Clerk-based
   frontend bundle.
2. **Revert the Convex commit**:

   ```bash
   git checkout <pre-cutover-sha>
   npx convex deploy
   ```

3. **Restore the Clerk Convex env var**:

   ```bash
   npx convex env --prod set CLERK_JWT_ISSUER_DOMAIN <prior-value>
   ```

4. The dormant `entitlements` table stays in the schema. The
   pre-cutover bundle does not read it.
5. The wipe from Step 9, if it ran, is permanent. Greenfield app with
   no production users → not a problem.
6. **Do not delete the Clerk project** in this scenario. Rolling back is
   only clean as long as Clerk is still alive.

### Rollback C — Post-Step-12 (Clerk already deleted)

If Step 12 has already been executed and a problem surfaces afterward,
rollback is more invasive:

1. Recreate the Clerk project in the Clerk dashboard.
2. Generate a new publishable key and re-add it to Vercel env.
3. Re-set `CLERK_JWT_ISSUER_DOMAIN` in Convex prod env.
4. Recreate any Clerk users (in a greenfield app this is trivial — there
   are none).
5. Rollback B steps 1 and 2 to revert the Vercel and Convex code.

To avoid Rollback C, **always** confirm Step 10's smoke checklist
passes before executing Step 12.

---

## Sign-off

- [ ] Steps 1 through 12 have all been executed and verified.
- [ ] The smoke checklist (Step 10 → `runbook-cutover-smoke.md`) has been
      retained alongside this runbook with every box ticked.
- [ ] The Clerk project has been deleted (Step 12) and 24 hours of clean
      prod logs confirm no Clerk traffic.

Migration complete.
