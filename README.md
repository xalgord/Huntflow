# HuntFlow

Your personal pentest command center. Track targets, time test sessions, capture evidence, draft reports, and manage findings — all from a single local-first app that runs entirely on your machine.

## Why HuntFlow?

- **Local-first, zero telemetry** — Your data stays in your browser. No accounts required, no tracking, nothing phones home.
- **Purpose-built for pentesters** — Every feature is designed around real penetration testing workflows, not retrofitted from generic project tools.
- **Offline-ready PWA** — Works without an internet connection. Install it like a native app.
- **Optional cloud sync** — Sign in to sync across devices when you need it. Skip it when you don't.

## Quick Start

Run HuntFlow locally with one command:

```bash
npx huntflow
```

Opens your browser at `http://localhost:3000` with a fresh workspace ready to go.

To install globally:

```bash
npm install -g huntflow
huntflow
```

Override the default port:

```bash
npx huntflow --port 4000
```

## What You Get

- **Target Tracker** — Organize engagements by priority, status, and scope
- **Focus Timer** — Timed test sessions with completion notes and tags
- **Notes** — Rich markdown notes with templates, preview, and autosave
- **Evidence Vault** — Proof files, URLs, code snippets, and relationship mapping
- **Report Builder** — Auto-populated reports with severity suggestions and PDF/markdown export
- **Stats Dashboard** — Visualize your testing patterns and progress
- **Findings Tracker** — Track findings through triage, resolution, and sign-off
- **Cloud Sync (Pro)** — Optional sync across devices with end-to-end security

## Screenshots

![HuntFlow dashboard](https://huntflow.xalgorix.com/screenshots/dashboard.png)

| Targets | Notes |
| --- | --- |
| ![Targets](https://huntflow.xalgorix.com/screenshots/targets.png) | ![Notes](https://huntflow.xalgorix.com/screenshots/notes.png) |

| Evidence | Findings |
| --- | --- |
| ![Evidence](https://huntflow.xalgorix.com/screenshots/evidence.png) | ![Findings](https://huntflow.xalgorix.com/screenshots/findings.png) |

## License

MIT License. Copyright © 2026 xalgorix.

See [`LICENSE`](./LICENSE) for the full text. You are free to use, modify, distribute, and sublicense this software.
