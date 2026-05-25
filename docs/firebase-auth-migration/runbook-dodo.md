# Runbook — Dodo Payments Setup

Operator-facing checklist for provisioning the Dodo Payments product, API
keys, and webhook that back HuntFlow's Pro entitlement. This runbook is the
source of truth for the four `DODO_*` Convex env vars.

It is executed after `runbook-firebase.md` and before the cutover steps in
`runbook-cutover.md`. The webhook URL it registers points at the Convex
deployment, so the Convex deployment slug must be known before Step 4 (see
`runbook-convex-env.md` Step 1 for how to read the slug).

Reference: `design.md` → "Dodo Payments Setup Checklist".

---

## Prerequisites

- [ ] Operator has admin access to the Dodo Payments dashboard.
- [ ] Operator knows the Convex deployment slug for the environment being
      provisioned (dev or prod). See `runbook-convex-env.md` Step 1.
- [ ] HuntFlow Pro pricing has been agreed.

---

## Step 1 — Sign in to the dashboard and switch to Test Mode

Console screen: Dodo Payments dashboard (the URL referenced in `.env.example`,
`app.xalgorix.com/home → Developer → API Keys`).

1. Sign in.
2. Toggle **Test Mode** (top-right environment switch) **on**. The entire
   initial provisioning happens in test mode; live mode is enabled only
   during cutover step 11 (see `runbook-cutover.md`).

---

## Step 2 — Create the HuntFlow Pro product

Console screen: **Products → Create product**.

1. Click **Create product**.
2. Fill in:
   - **Name**: `HuntFlow Pro`.
   - **Type**: `Subscription`.
   - **Price**: match the price the pre-migration Clerk Pro plan charged.
   - **Billing interval**: `Monthly`.
   - **Currency**: leave the dashboard default unless the operator
     intentionally wants a different currency.
3. Click **Save**.
4. Copy the **Product ID** that the dashboard displays. This becomes
   `DODO_PRO_PRODUCT_ID`.

Only one tier is provisioned. Multi-tier billing is out of scope for this
migration (Requirement 7.7).

---

## Step 3 — Copy the test API key

Console screen: **Developer → API Keys**.

1. Click **Copy** on the test API key row, or click **Reveal** then copy
   the value.
2. Store the value as `DODO_API_KEY`.
3. The base URL for test mode is `https://test.dodopayments.com`. This becomes
   `DODO_API_BASE_URL`.

The single `DODO_API_KEY` switches between test and live based on the
`DODO_API_BASE_URL` value — there is no `DODO_API_KEY_TEST` / `DODO_API_KEY_LIVE`
split.

---

## Step 4 — Register the webhook

Console screen: **Developer → Webhooks → Add Webhook**.

The webhook URL points at the Convex HTTP router defined in `convex/http.ts`.
The shape is:

```
https://<convex-deployment>.convex.site/dodo-webhook
```

The operator gets `<convex-deployment>` (the deployment slug) from one of:

- Running `npx convex dev` against the dev deployment — the slug appears in
  the startup banner.
- The Convex dashboard at <https://dashboard.convex.dev> — open the
  deployment and read the slug from the URL.
- Reading `CONVEX_DEPLOYMENT` from `.env.local` (dev) or the project's
  Vercel env (prod).

For the prod environment the slug is the value associated with
`VITE_CONVEX_URL` in Vercel, with the `convex.cloud` host swapped for
`convex.site` (Convex serves HTTP routes from `*.convex.site`).

Steps:

1. Click **Add Webhook**.
2. **Endpoint URL**: paste
   `https://<convex-deployment>.convex.site/dodo-webhook`.
3. **Description**: `HuntFlow entitlement sync` (any human-readable string).
4. **Events to subscribe**: select exactly these five subscription events:
   - `subscription.active`
   - `subscription.renewed`
   - `subscription.cancelled`
   - `subscription.expired`
   - `subscription.failed`

   Skip `payment.*`, `dispute.*`, and `refund.*` — HuntFlow's webhook handler
   ignores those event types.
5. Click **Create**.
6. After creation, click the webhook row to reveal its **Signing secret**.
   Copy the value. This becomes `DODO_WEBHOOK_SIGNING_SECRET`.

---

## Step 5 — Customer Portal

No dashboard configuration is required. Dodo provides per-customer portal
sessions via the `POST /customers/{id}/customer-portal/sessions` endpoint,
which `convex/dodo.ts` calls from `getCustomerPortalUrl`.

Confirm portal access works during the smoke checklist
(`runbook-cutover-smoke.md` → Manage subscription).

---

## Step 6 — Test → Live switch (cutover step 11 only)

This step runs at the very end of cutover, after the smoke checklist passes
in test mode. Do not run it during initial provisioning.

When the operator reaches step 11 of `runbook-cutover.md`:

1. Toggle **Live Mode** on the dashboard.
2. Repeat **Step 2** (create the `HuntFlow Pro` product in live mode). Live
   mode has its own product catalog; the test-mode product ID does not
   carry over.
3. Repeat **Step 3** (copy the live API key). Set `DODO_API_BASE_URL` to
   `https://live.dodopayments.com`.
4. Repeat **Step 4** (register a new webhook in live mode pointed at the
   same `https://<convex-deployment>.convex.site/dodo-webhook` URL).
   Live-mode webhooks have their own signing secret — copy it.
5. Update Convex env (see `runbook-convex-env.md` Step 4) with the new live
   values for `DODO_API_BASE_URL`, `DODO_API_KEY`,
   `DODO_WEBHOOK_SIGNING_SECRET`, and `DODO_PRO_PRODUCT_ID`. No code change
   or redeploy is required — Convex env updates take effect immediately.

---

## Step 7 — Signing-secret rotation

Per Dodo Payments documentation, rotating the webhook signing secret in the
dashboard keeps the previous secret valid for **24 hours** after rotation.
That overlap window means rotation does not require a hard cutover, but
rotations should still be planned during a low-traffic maintenance window.

Rotation procedure:

1. In **Developer → Webhooks → \<the HuntFlow webhook\> → Signing secret**,
   click **Rotate**.
2. Copy the new secret.
3. Update Convex env immediately (`runbook-convex-env.md` Step 4):

   ```bash
   npx convex env set DODO_WEBHOOK_SIGNING_SECRET <new-secret>
   ```

4. Convex picks up the new secret on the next request. Both the old and new
   secrets are accepted for 24 hours; after that, the old secret is rejected.
5. After 24 hours, confirm in the Dodo dashboard delivery log that no events
   are failing signature verification.

---

## Captured values

After completing Steps 1 through 5, the operator has the following values
ready to paste into Convex via `npx convex env set` (see
`runbook-convex-env.md`):

| Variable | Source | Test-mode value | Live-mode value (cutover step 11) |
| --- | --- | --- | --- |
| `DODO_API_BASE_URL` | Step 3 | `https://test.dodopayments.com` | `https://live.dodopayments.com` |
| `DODO_API_KEY` | Step 3 | Test API key | Live API key |
| `DODO_WEBHOOK_SIGNING_SECRET` | Step 4 | Test webhook signing secret | Live webhook signing secret |
| `DODO_PRO_PRODUCT_ID` | Step 2 | Test product ID | Live product ID |

Next runbook in the sequence: `runbook-convex-env.md`.
