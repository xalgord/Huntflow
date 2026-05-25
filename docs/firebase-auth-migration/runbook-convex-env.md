# Runbook — Convex Environment Variables

Operator-facing checklist for setting and verifying the five server-side
environment variables that Convex reads at runtime. This is the bridge
between `runbook-firebase.md` (which produces `FIREBASE_PROJECT_ID`),
`runbook-dodo.md` (which produces the four `DODO_*` values), and the
deploy steps in `runbook-cutover.md`.

Reference: `design.md` → "Components and Interfaces — Build Surface →
.env.example" and "Cutover Playbook" steps 4 and 5.

---

## Required server-side env vars

| Variable | Consumer | Notes |
| --- | --- | --- |
| `FIREBASE_PROJECT_ID` | `convex/auth.config.ts` | Firebase project ID. Same string as `VITE_FIREBASE_PROJECT_ID` on the client. |
| `DODO_API_BASE_URL` | `convex/dodo.ts` | `https://test.dodopayments.com` or `https://live.dodopayments.com`. |
| `DODO_API_KEY` | `convex/dodo.ts` | Single API key — switches with `DODO_API_BASE_URL`. |
| `DODO_WEBHOOK_SIGNING_SECRET` | `convex/http.ts` | Standard Webhooks signing secret from the Dodo dashboard. |
| `DODO_PRO_PRODUCT_ID` | `convex/dodo.ts` | Dodo product ID for HuntFlow Pro. |

`CLERK_JWT_ISSUER_DOMAIN` is no longer read by any Convex code after this
migration. It must either be unset before cutover (if the operator wants
zero pre-cutover blast radius) or scheduled for cleanup after the smoke
checklist passes. Both options are documented below.

---

## Step 1 — Identify the target deployment

Convex CLI commands run against the deployment configured in
`CONVEX_DEPLOYMENT` (or `--prod` for the production deployment). Identify
which deployment is being configured before running anything.

For the dev deployment:

```bash
cat .env.local | grep CONVEX_DEPLOYMENT
```

Or run `npx convex dev` and read the slug from the startup banner.

For the prod deployment, every command in this runbook is prefixed with
`--prod`:

```bash
npx convex env --prod list
```

The deployment slug feeds into the webhook URL registered in
`runbook-dodo.md` Step 4 (`https://<slug>.convex.site/dodo-webhook`).

---

## Step 2 — Set the five env vars (dev deployment)

The dev deployment uses the **test-mode** Dodo values produced by
`runbook-dodo.md` Steps 1 through 5. Substitute the captured values into
the commands below.

```bash
npx convex env set FIREBASE_PROJECT_ID            <firebase-project-id>
npx convex env set DODO_API_BASE_URL              https://test.dodopayments.com
npx convex env set DODO_API_KEY                   <dodo-test-api-key>
npx convex env set DODO_WEBHOOK_SIGNING_SECRET    <dodo-test-webhook-signing-secret>
npx convex env set DODO_PRO_PRODUCT_ID            <dodo-test-product-id>
```

Each command emits a single confirmation line. If any command emits an
error about an unauthenticated CLI or a missing deployment, run
`npx convex login` and re-try.

---

## Step 3 — Set the five env vars (prod deployment, test-mode values first)

This corresponds to cutover step 5 in `runbook-cutover.md`. The prod
deployment is initially populated with **test-mode** Dodo values so the
operator can run the smoke checklist (`runbook-cutover-smoke.md`) safely
against test transactions before flipping to live mode.

```bash
npx convex env --prod set FIREBASE_PROJECT_ID            <firebase-project-id>
npx convex env --prod set DODO_API_BASE_URL              https://test.dodopayments.com
npx convex env --prod set DODO_API_KEY                   <dodo-test-api-key>
npx convex env --prod set DODO_WEBHOOK_SIGNING_SECRET    <dodo-test-webhook-signing-secret>
npx convex env --prod set DODO_PRO_PRODUCT_ID            <dodo-test-product-id>
```

`FIREBASE_PROJECT_ID` is the same value in dev and prod **only** if the
operator chose to use a single Firebase project for both environments.
The default plan is two Firebase projects (`huntflow-dev`, `huntflow-prod`),
so the prod value here is the prod Firebase project's ID.

Do **not** unset `CLERK_JWT_ISSUER_DOMAIN` yet. The pre-cutover Convex
deployment is still serving the old code that reads it; unsetting it
before the new bundle deploys breaks production. Cleanup happens in
Step 5.

---

## Step 4 — Switch prod to live-mode Dodo values (cutover step 11)

After the smoke checklist passes (`runbook-cutover-smoke.md`), and after
`runbook-dodo.md` Step 6 has produced live-mode values, repoint the four
`DODO_*` vars at live mode. `FIREBASE_PROJECT_ID` does not change.

```bash
npx convex env --prod set DODO_API_BASE_URL              https://live.dodopayments.com
npx convex env --prod set DODO_API_KEY                   <dodo-live-api-key>
npx convex env --prod set DODO_WEBHOOK_SIGNING_SECRET    <dodo-live-webhook-signing-secret>
npx convex env --prod set DODO_PRO_PRODUCT_ID            <dodo-live-product-id>
```

No code change or redeploy is required — Convex env updates take effect
on the next request.

---

## Step 5 — Verification

Run the verification commands against whichever deployment was just
configured. Examples below target the dev deployment; substitute `--prod`
for the production check.

### 5a. List all env vars

```bash
npx convex env list
```

Expected output: a table that includes each of the five required
variables. Every one should display `(set)` or its non-secret value
truncated. If any row is missing, re-run the matching `set` command from
Step 2 or Step 3.

### 5b. Grep for each required variable

For an explicit pass/fail signal:

```bash
npx convex env list | grep -E '^FIREBASE_PROJECT_ID\b'
npx convex env list | grep -E '^DODO_API_BASE_URL\b'
npx convex env list | grep -E '^DODO_API_KEY\b'
npx convex env list | grep -E '^DODO_WEBHOOK_SIGNING_SECRET\b'
npx convex env list | grep -E '^DODO_PRO_PRODUCT_ID\b'
```

Each command must print exactly one matching line and exit 0. A missing
variable causes `grep` to exit 1 — that is the failure signal.

### 5c. Confirm `CLERK_JWT_ISSUER_DOMAIN` is gone (post-cutover)

```bash
npx convex env list | grep -E '^CLERK_JWT_ISSUER_DOMAIN\b' && echo "STILL SET" || echo "ok: unset"
```

Expected output during pre-cutover: `STILL SET` (the legacy code still
reads it). Expected output after cutover step 12: `ok: unset`.

To unset it after the smoke checklist passes:

```bash
npx convex env --prod unset CLERK_JWT_ISSUER_DOMAIN
```

---

## Dev vs prod summary

| Phase | Deployment | `DODO_API_BASE_URL` | `DODO_API_KEY` etc. |
| --- | --- | --- | --- |
| Local development | dev | `https://test.dodopayments.com` | Test-mode values |
| Cutover steps 5 – 10 | prod | `https://test.dodopayments.com` | Test-mode values (so the smoke checklist runs against test transactions) |
| Cutover step 11 onward | prod | `https://live.dodopayments.com` | Live-mode values |

The dev deployment never points at live-mode Dodo, even after cutover.

Next runbook in the sequence: `runbook-cutover-smoke.md`.
