# Firebase Auth + Dodo Payments Migration — Operator Runbooks

These runbooks walk an operator through the production cutover from Clerk Auth + Clerk Billing to Firebase Auth + Dodo Payments. They are reference material; the agent does not execute production steps.

## Reading order

1. [`runbook-firebase.md`](./runbook-firebase.md) — provision the Firebase project (auth providers, authorized domains, password policy, email templates, web app config).
2. [`runbook-dodo.md`](./runbook-dodo.md) — provision the Dodo Payments product, API key, and webhook.
3. [`runbook-convex-env.md`](./runbook-convex-env.md) — set the five server-side env vars on the Convex deployment (dev and prod).
4. [`runbook-cutover.md`](./runbook-cutover.md) — the 12-step cutover playbook plus rollback procedures (A, B, C).
5. [`runbook-cutover-smoke.md`](./runbook-cutover-smoke.md) — smoke checklist run after the new bundle is live but before flipping Dodo to live mode.

The cutover is a hard cutover for a greenfield app: no production users, no Clerk → Firebase user export, and no dual-stack token window. Existing Convex rows tied to old Clerk-derived `ownerId` values are wiped via the internal `entitlements:wipeLegacyOwnerData` mutation during step 9.

## Why these exist

Source spec lives in the local agent workspace at `.kiro/specs/firebase-auth-migration/` (gitignored) and contains the full requirements/design/tasks documents. These runbooks are the operator-facing slice extracted from that spec so cutover doesn't depend on agent tooling being present.
