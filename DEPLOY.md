# Deploying HuntFlow to huntflow.xalgorix.com

This guide walks through every piece needed to put HuntFlow on a custom Vercel domain
with working authentication, real-time cloud sync, and Pro subscriptions.

## 1. Architecture overview

```
Browser
  |
  v
Vercel (static SvelteKit build, served from huntflow.xalgorix.com)
  |
  +--> Clerk Frontend API     (auth + Pro plan entitlement)
  |       |
  |       +-- Clerk Billing   (paid Pro subscriptions)
  |
  +--> Convex                 (real-time cloud sync, gated to Pro users)
```

- **Static frontend**: SvelteKit + `@sveltejs/adapter-static` → fully static `build/`.
- **Auth**: Clerk (embedded `mountSignIn` / `mountSignUp` widgets, custom-styled).
- **Billing**: Clerk Billing (`mountPricingTable`, plan name `huntflow_pro`).
- **Backend**: Convex for real-time sync. Gate enforced both client-side
  (`syncNow()` throws `ProRequiredError`) and inside Convex functions via
  the JWT claim that Clerk includes for paid users.

## 2. One-time provider setup

### 2.1 Clerk

1. Create a Clerk application (production instance).
2. Settings → Domains → add `huntflow.xalgorix.com`.
3. Settings → Authentication → enable email + the social providers you want
   (Google, GitHub recommended).
4. Settings → Customization → Paths:
   - Sign-in URL: `/sign-in`
   - Sign-up URL: `/sign-up`
   - After sign-in URL: `/`
   - After sign-up URL: `/`
5. Settings → Sessions → JWT templates → **New template** named `convex`,
   audience `convex`, issuer auto-filled. Save the issuer URL — you'll
   paste it into Convex.
6. Settings → Billing → enable Clerk Billing. Create a plan:
   - Plan key: `huntflow_pro`
   - Display name: HuntFlow Pro
   - Monthly: $6 USD
   - Annual: $60 USD (optional)
   - Connect to your Stripe account when prompted.
7. Copy the **Publishable Key** (`pk_live_...`) into your Vercel env vars
   as `VITE_CLERK_PUBLISHABLE_KEY`.

### 2.2 Convex

1. `npx convex deploy` to create a production deployment.
2. In the Convex dashboard:
   - Project Settings → Auth → add Clerk provider.
   - Issuer URL = your Clerk JWT issuer (from step 2.1.5).
   - Audience = `convex`.
3. Copy the deployment URL (`https://something.convex.cloud`) — that's
   `VITE_CONVEX_URL`.
4. Add the Clerk issuer in Convex env: `CLERK_JWT_ISSUER_DOMAIN=...`.

## 3. Vercel project configuration

### 3.1 Import the GitHub repo

1. New Project → import `xalgord/huntflow`.
2. Framework preset: **SvelteKit (auto-detected)**.
3. Build Command: `npm run build` (already in `vercel.json`).
4. Output Directory: `build` (already in `vercel.json`).

### 3.2 Environment variables

Set these in Vercel → Project → Settings → Environment Variables (Production scope):

| Variable | Value | Where it comes from |
| --- | --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | Clerk dashboard |
| `VITE_CONVEX_URL` | `https://*.convex.cloud` | Convex dashboard |
| `VITE_CLERK_FRONTEND_API_URL` | `https://*.clerk.accounts.dev` | Clerk dashboard |
| `CONVEX_DEPLOY_KEY` | `prod:...` | Convex dashboard (only if you use `convex deploy` from CI) |

### 3.3 Custom domain

1. Project → Settings → Domains → Add `huntflow.xalgorix.com`.
2. At your DNS provider (`xalgorix.com`), add a CNAME:
   - Name: `huntflow`
   - Value: `cname.vercel-dns.com`
3. Wait for the certificate to provision (usually under a minute).
4. Vercel will automatically redirect `*.vercel.app` URLs → custom domain.

### 3.4 Verify the deploy

After the first push to `main`:

- `https://huntflow.xalgorix.com/` → app dashboard
- `https://huntflow.xalgorix.com/landing` → marketing page
- `https://huntflow.xalgorix.com/sign-in` → embedded Clerk sign-in
- `https://huntflow.xalgorix.com/sign-up` → embedded Clerk sign-up
- `https://huntflow.xalgorix.com/pricing` → Clerk Billing pricing table

## 4. Pro / Free plan model

| Capability | Free | Pro ($6/mo) |
| --- | --- | --- |
| Targets, sessions, notes, recon, evidence, payouts, submissions | ✓ | ✓ |
| Hunter toolkit (encoder/JWT/scope validator) | ✓ | ✓ |
| Stats, streaks, ROI per program | ✓ | ✓ |
| Encrypted manual backup / restore | ✓ | ✓ |
| Works fully offline | ✓ | ✓ |
| **Real-time cloud sync across devices** |   | ✓ |
| **End-to-end encrypted evidence in cloud** |   | ✓ |
| **Priority support** |   | ✓ |

The free plan is the entire app minus cloud sync. No login is required to
use Free — IndexedDB storage is enough.

### Where Pro is enforced

| Layer | File | Behaviour |
| --- | --- | --- |
| Client gate | `src/lib/cloud/sync.ts` | `syncNow()` throws `ProRequiredError` if `clerkAuthStore.isPro` is false. |
| UI gate | `src/lib/components/settings/CloudSyncSettings.svelte` | Renders an upgrade paywall instead of the sync controls when not Pro. |
| Server gate (recommended) | `convex/sync.ts` | Inside each mutation, check `ctx.auth.getUserIdentity()?.publicMetadata.plan === 'huntflow_pro'`. Reject otherwise. |

## 5. NPM distribution (one-command install)

The same codebase ships as both:

- **Hosted**: `https://huntflow.xalgorix.com`
- **Local CLI**: `npx huntflow` (serves `build/` on `localhost:3000`)

`bin/huntflow.mjs` and `bin/prepare.mjs` are already configured. To publish:

```bash
npm login
npm publish        # uses prepublishOnly to run npm run build
```

## 6. Production checklist

- [ ] DNS CNAME set on `huntflow.xalgorix.com` → `cname.vercel-dns.com`
- [ ] All four env vars set on Vercel (Production scope)
- [ ] Clerk app domain includes `huntflow.xalgorix.com`
- [ ] Clerk JWT template `convex` exists
- [ ] Clerk plan `huntflow_pro` configured + connected to Stripe
- [ ] Convex deployment auth provider points to Clerk JWT issuer
- [ ] First sign-up flow works end-to-end: `/sign-up` → email verify → `/`
- [ ] Pricing flow works: `/pricing` → upgrade → returns to `/?welcome=pro`
- [ ] Cloud sync works for a Pro test user (Settings → Cloud Sync → Sync Now)
- [ ] Cloud sync paywall appears for a free signed-in user
