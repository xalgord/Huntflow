# HuntFlow Testing Checklist

Use this checklist before shipping UI, data, auth, sync, or PWA changes. The automated coverage lives in `tests/e2e` and is run with `npm run test:e2e`.

## Automated Baseline

- [ ] `npm run check` passes with 0 Svelte/TypeScript errors.
- [ ] `npm run test -- --run` passes all unit tests.
- [ ] `npm run build` completes successfully; the known acceptable warning is the large Clerk chunk.
- [ ] `npm run test:e2e` passes the Playwright route, responsive, onboarding, workflow, settings, data, and cloud-state tests.
- [ ] Browser console has no app-level `console.error`, page error, 500, hydration mismatch, circular import, IndexedDB, Clerk, Convex, canvas, or service worker runtime failure on primary routes including `/assets`.

## Visual, Responsive, And Accessibility QA

- [ ] Check dashboard at `1440x1100`, `768x1024`, `390x844`, and `360x740`.
- [ ] Confirm the 0xCommune-inspired direction remains intact: black base, green accents, rounded cards, Inter-first typography, security-community tone.
- [ ] Confirm no text clipping, horizontal overflow, broken wrapping, overlapped cards, or nav/content collision.
- [ ] Keyboard tab order reaches nav, primary CTAs, forms, modals, filters, workflow rows, settings, and destructive actions.
- [ ] Interactive states are visible for default, hover, focus-visible, active, disabled/loading, and error states.
- [ ] Body text, muted text, buttons, badges, terminal text, empty states, and form errors meet WCAG AA contrast.
- [ ] Page motion does not block interaction or cause obvious layout jumps.
- [ ] Route title, meta description, canonical, robots, and social metadata are route-appropriate.

## Core Product Workflows

- [ ] First-run onboarding appears only on non-landing routes, has 6 steps, supports clickable dots/swipe, Skip always works, and final CTA routes to `/timer`.
- [ ] Dashboard empty and populated states are useful and reflect real store data.
- [ ] Dashboard workflow selection updates the detail panel; “Start hunt room” routes to `/timer/`.
- [ ] Targets can be created, searched, filtered, opened, edited, moved through status, archived/deleted, and started through `/timer?target=<id>`.
- [ ] Timer blocks start without a target, then supports start, pause, resume, complete, abandon, and reset.
- [ ] Completed sessions update session history, target status/count, dashboard metrics, and stats.
- [ ] Notes can be created, templated, edited, previewed, tagged, autosaved as drafts, explicitly saved, searched, and deleted.
- [ ] Evidence assets can be uploaded, pasted, captured as URLs/snippets, filtered, previewed, downloaded/opened, linked to targets/sessions/notes, deleted, and rendered on the graph canvas.
- [ ] Report Builder auto-populates from notes, suggests severity from tags, previews markdown, exports `.md`, copies markdown, and triggers client PDF export.
- [ ] Stats derive from sessions only and charts refresh after late store data loads.
- [ ] Income supports payout create/edit/delete, Pending -> Triaged -> Paid advancement, charts, and tax CSV export.
- [ ] Settings persist appearance/timer changes immediately; import/export validates; clear-data requires typed confirmation.

## Auth, Cloud Sync, Data, And PWA

- [ ] Missing Clerk or Convex config shows actionable setup UI instead of a crash.
- [ ] Signed-out Clerk state shows sign-in/sign-up actions; signed-in state shows user identity/profile controls.
- [ ] Cloud sync can push/pull without duplicating local records, local evidence has no enforced size/quota cap, and cloud evidence uploads respect the 100MB file and 1GB user quota.
- [ ] Sync failures/offline state never destroy local IndexedDB data silently.
- [ ] Export/import round trip preserves targets, sessions, notes, payouts, evidence metadata/links/canvas views, templates, and settings.
- [ ] PWA install prompt appears only under intended conditions and remembers dismissal.
- [ ] Offline route load shows cached shell/offline banner and keeps local data available.
- [ ] Clearing browser/site data resets onboarding and local app state predictably.

## Release Acceptance

- [ ] Fresh browser profile smoke test passes onboarding -> add target -> start timer -> complete session -> create note -> view dashboard/stats.
- [ ] Existing-user smoke test passes with seeded data and no onboarding interruption.
- [ ] Mobile touch-only smoke test passes the same core flow.
- [ ] Keyboard-only smoke test passes dashboard, target creation, note creation, modal close/confirm, and settings.
- [ ] Production preview or deployed build matches local dev visually and functionally.
- [ ] No route shows 500/Internal Error after hard refresh, direct URL entry, or service-worker cache refresh.
