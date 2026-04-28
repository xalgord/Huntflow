# HuntFlow

HuntFlow is a local-first bug bounty workflow app for tracking targets, timed hunt sessions, evidence notes, report drafts, payout income, and optional cloud sync.

## Screenshots

The screenshots below are captured from the real app with seeded sample bounty data.

![HuntFlow dashboard with sample targets, evidence, payouts, and sync status](docs/screenshots/dashboard.png)

| Target detail | Notes preview |
| --- | --- |
| ![Target detail screen showing status pipeline, scope, and session history](docs/screenshots/target-detail.png) | ![Markdown note preview showing reproduction steps, impact, and remediation](docs/screenshots/notes-preview.png) |

| Stats dashboard | Income tracker |
| --- | --- |
| ![Stats dashboard with hunting time, streak, weekly activity, and vulnerability charts](docs/screenshots/stats.png) | ![Income tracker with payout totals, earnings chart, tax export, and payout rows](docs/screenshots/income.png) |

## Stack

- SvelteKit, Svelte 4, TypeScript, Vite
- Tailwind CSS with a custom dark security-workspace design system
- IndexedDB for local-first persistence
- Convex for optional cloud sync
- Clerk for authentication
- Chart.js for analytics charts and d3-force for the evidence graph canvas
- Playwright and Vitest for testing
- Static adapter with PWA support

## Features

- Target tracker with platform, priority, status, scope, search, and session linking
- Focus timer for hunt rooms with completion notes and tags
- Markdown notes with templates, preview, autosave drafts, and explicit save
- Evidence asset vault for proof files, folder uploads, URLs, snippets, relationships, analytics, and graph canvas views
- Report Builder with note auto-population, severity suggestions, markdown export, and client PDF export
- Stats dashboard derived from session data
- Income tracker with payout status progression and tax CSV export
- Settings, data import/export, typed clear-data confirmation, PWA install, and offline shell support
- Optional Pro cloud sync through Clerk and Convex

## Install

Run HuntFlow locally with one command. No account, no telemetry, no cloud — your data lives in IndexedDB on this device.

```bash
npx huntflow
```

This starts a tiny static server, opens your browser at `http://localhost:3000`, and drops you into a fresh local workspace. Sign-in is optional and only enables cloud sync; the app is fully usable without an account.

To install globally so `huntflow` is on your PATH:

```bash
npm install -g huntflow
huntflow
```

Pass `--port` to override the default:

```bash
npx huntflow --port 4000
```

## Local development

For working on HuntFlow itself rather than running it:

```bash
git clone https://github.com/xalgord/huntflow.git
cd huntflow
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL printed by Vite.

## Environment

Use `.env.example` as the template for local configuration. Do not commit `.env.local`.

Required for cloud sync:

```bash
VITE_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
VITE_CONVEX_URL=
VITE_CONVEX_SITE_URL=
CONVEX_DEPLOYMENT=
CONVEX_DEPLOY_KEY=
CLERK_JWT_ISSUER_DOMAIN=
```

Cloud sync should fail gracefully when these values are missing.

## Scripts

```bash
npm run dev               # development server with HMR
npm run check             # type-check + svelte-check
npm run test -- --run     # unit tests (Vitest)
npm run test:e2e          # end-to-end tests (Playwright)
npm run screenshots       # regenerate README screenshots from sample data
npm run build             # default build (alias for build:web)
npm run build:web         # hosted website build (huntflow.xalgorix.com)
npm run build:app         # local app build for npm publish
```

### Build modes

HuntFlow ships two distinct builds from one codebase:

- **`build:web`** — the hosted experience at `huntflow.xalgorix.com`. Includes the marketing landing, `/pricing`, `/demo` with seeded sample data, Clerk-gated app routes, and Stripe billing.
- **`build:app`** — the npm-published binary. `bin/build-app.mjs` strips the marketing routes from `src/routes/` before invoking Vite, replaces `/` with a redirect to `/dashboard`, and tree-shakes web-only code paths via the `IS_APP` / `IS_WEB` constants in `src/lib/buildTarget.ts`. Sign-in remains available but is opt-in for cloud sync only — it never blocks access. The original route files are restored in a `try/finally` so the working tree is always clean.

`npm publish` automatically runs `build:app` via `prepublishOnly`. Vercel deploys run the default `build` script, which is `build:web`.

## Testing

The release checklist is in `docs/testing-checklist.md`. The Playwright suite covers onboarding, primary routes, responsive overflow, SEO basics, keyboard reachability, targets, timer, notes, evidence assets, income, settings data management, and cloud-sync state handling.

For manual note, preview, and report-builder testing, use `docs/sample-note.md`.

## License

HuntFlow is proprietary software. Copyright (c) 2026 xalgord. All rights reserved.

You may install and use HuntFlow on your own devices for personal or internal business use under the terms in [`LICENSE`](./LICENSE). Redistribution, resale, sublicensing, reverse engineering, and removal of attribution are not permitted. The published npm package contains the compiled application and CLI launcher only — source is not licensed for use.

For commercial licensing, custom deployments, or partnership inquiries, contact the maintainer through [huntflow.xalgorix.com](https://huntflow.xalgorix.com).
