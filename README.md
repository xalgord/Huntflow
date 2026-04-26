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
- Chart.js for stats and income charts
- Playwright and Vitest for testing
- Static adapter with PWA support

## Features

- Target tracker with platform, priority, status, scope, search, and session linking
- Focus timer for hunt rooms with completion notes and tags
- Markdown notes with templates, preview, autosave drafts, and explicit save
- Report Builder with note auto-population, severity suggestions, markdown export, and client PDF export
- Stats dashboard derived from session data
- Income tracker with payout status progression and tax CSV export
- Settings, data import/export, typed clear-data confirmation, PWA install, and offline shell support
- Optional Pro cloud sync through Clerk and Convex

## Getting Started

```bash
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
npm run dev
npm run check
npm run test -- --run
npm run test:e2e
npm run screenshots
npm run build
```

## Testing

The release checklist is in `docs/testing-checklist.md`. The Playwright suite covers onboarding, primary routes, responsive overflow, SEO basics, keyboard reachability, targets, timer, notes, income, settings data management, and cloud-sync state handling.

## License

No license has been selected yet. Add a license before accepting external contributions or distributing this as open source.
