# HuntFlow — Bug Bounty Productivity Companion

> **Tagline:** Hunt smarter. Stay consistent. Get paid.

## Overview

HuntFlow is a lightweight, offline-first Progressive Web App (PWA) designed specifically for bug bounty hunters. It gamifies and organizes the entire bug bounty workflow — from recon to reporting — helping hunters build consistency, save time on reports, and track their income across platforms.

Unlike generic productivity tools, HuntFlow understands the security researcher's workflow. No more duct-taping Toggl, Notion, and spreadsheets together.

---

## Problem Statement

Bug bounty hunters currently struggle with:
1. **Inconsistency** — No habit-building tools tailored to hunting
2. **Report friction** — Writing structured reports from scattered notes takes 30-60 minutes
3. **Financial chaos** — Tracking payouts across HackerOne, Bugcrowd, and Intigriti is painful
4. **Tool fragmentation** — Using 4-5 generic apps for one workflow
5. **Offline needs** — Hunting often happens on the go, in cafes, or behind VPNs with spotty connectivity

---

## Solution

A single, focused PWA that combines:
- **Focus Sessions** — Pomodoro-style hunting timers with target labels
- **Security-First Notes** — Templates for common vulnerability types
- **Target Tracker** — Program/scope management
- **Streaks & Stats** — Visual consistency and earnings dashboards
- **Offline-First** — Works without internet, syncs when available

---

## Target Audience

| Segment | Description | Pain Level |
|---------|-------------|------------|
| **New Hunters** | 0-6 months experience, struggling with consistency | 🔥🔥🔥🔥🔥 |
| **Active Hunters** | 6-24 months, submitting regularly, hate reporting | 🔥🔥🔥🔥 |
| **Pro Hunters** | 2+ years, multi-platform, need income tracking | 🔥🔥🔥 |
| **Hunting Teams** | 2-5 people collaborating on targets | 🔥🔥🔥🔥 |

**Total Addressable Market:** ~100,000 active bug bounty hunters globally
**Serviceable Market:** ~30,000 hunters who hunt at least monthly

---

## Tech Stack

### Frontend
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | **SvelteKit** | Ultra-lightweight, minimal JS footprint, excellent PWA support |
| Styling | **Tailwind CSS** | Utility-first, tiny bundle size |
| State | **Svelte Stores** + **IndexedDB** | No heavy state library needed |
| Icons | **Lucide** | Lightweight, consistent |
| PWA | **Vite PWA Plugin** | Service worker, offline caching, install prompts |

### Backend (Subscription Features Only)
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| API | **Node.js + Fastify** | Lightweight, faster than Express |
| Database | **PostgreSQL** | Reliable, great for relational data (users, sync, teams) |
| Auth | **Lucia Auth** | Simple, framework-agnostic, session-based |
| Storage | **AWS S3 / R2** | Report exports, attachments |
| Hosting | **Railway / Render** | Simple deploy, auto-scaling |

### DevOps
| Tool | Purpose |
|------|---------|
| GitHub Actions | CI/CD |
| Vercel | Frontend hosting |
| Sentry | Error tracking |
| Plausible | Privacy-focused analytics |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (PWA)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  SvelteKit   │  │  IndexedDB   │  │  Service Worker  │  │
│  │    UI Layer  │  │  (Local DB)  │  │  (Offline Cache) │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                              │
│  Features: Focus Timer │ Note Templates │ Target Tracker    │
│            Streaks     │ Stats Dashboard│ Income Tracker    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Sync (when online)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API SERVER (Node/Fastify)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Auth        │  │  Sync API    │  │  Report Builder  │  │
│  │  (Lucia)     │  │  (Conflict   │  │  (Markdown Gen)  │  │
│  └──────────────┘  │   Resolution)│  └──────────────────┘  │
│                    └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   PostgreSQL     │
                    │   (User Data)    │
                    └──────────────────┘
```

### Data Flow (Offline-First)
1. All writes go to **IndexedDB** first (instant, offline)
2. Background sync queue pushes to server when online
3. Conflict resolution: **last-write-wins** with manual merge option
4. Server validates and persists to PostgreSQL

---

## MVP Feature Set

### Core (Free Forever)

#### 1. Focus Sessions
- Pomodoro timer (25min focus / 5min break / 15min long break)
- Label sessions with target name + program
- Session history with notes
- Daily/weekly hunting time stats
- **Gamification:** Streaks for consecutive hunting days

#### 2. Quick Notes
- Pre-built templates:
  - Subdomain Takeover
  - IDOR
  - SSRF
  - SQL Injection
  - XSS
  - Authentication Bypass
  - Information Disclosure
  - Business Logic Flaw
- Custom templates (user-defined)
- Rich text (markdown) with code blocks
- Tag system (#critical, #todo, #report-ready)
- Link notes to specific targets

#### 3. Target Tracker
- Add programs manually (name, platform, scope, URL)
- Status per target: `Recon` → `Testing` → `Reported` → `Paid` → `Closed`
- Priority levels (P0-P3)
- Quick notes linked to targets
- Due dates for program deadlines

#### 4. Stats Dashboard
- Total hunting hours (today/week/month)
- Current streak (consecutive days with ≥1 session)
- Longest streak
- Sessions by vulnerability type
- Target completion rate
- Visual charts (lightweight, canvas-based)

#### 5. Offline-First
- Full functionality without internet
- Automatic sync when connection returns
- Export data as JSON (backup)

### Subscription (Pro Tier — $6/month)

#### 6. Cloud Sync
- Real-time sync across all devices
- Web + Android (PWA install)
- Conflict resolution UI

#### 7. Report Builder
- Auto-generate markdown reports from session notes
- Templates for HackerOne, Bugcrowd, Intigriti formats
- Severity auto-suggestion based on tags
- Proof-of-Concept section with code snippet formatting
- One-click export (.md, .pdf)

#### 8. Income Tracker
- Log payouts with program, platform, severity, date
- Charts: Earnings over time, by platform, by severity
- Tax export (CSV for accountant)
- Payout status tracking (Pending → Triaged → Paid)

#### 9. Team Hunts (Future)
- Share targets with team members
- Collaborative notes
- Shared session tracking

---

## User Flow (MVP)

```
[Install PWA] → [Dashboard]
                   │
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
[Start Focus]  [Add Target]  [Write Note]
     │             │             │
     ▼             ▼             ▼
[Timer Runs]   [Set Status]  [Pick Template]
     │             │             │
     ▼             ▼             ▼
[Log Session]  [View Stats]  [Link to Target]
     │                           │
     └─────────────┬─────────────┘
                   ▼
            [Stats Dashboard]
                   │
         [Upgrade to Pro?]
                   │
            [Report Builder]
            [Income Tracker]
            [Cloud Sync]
```

---

## Monetization Strategy

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | Focus sessions, notes (3 templates), target tracker, stats, offline mode |
| **Pro** | $6/mo or $50/yr | Unlimited templates, cloud sync, report builder, income tracker |
| **Team** | $15/mo (5 seats) | Everything in Pro + shared targets, collaborative notes |

**Pricing Psychology:**
- Free tier is genuinely useful (builds habit)
- Pro saves 30+ min per report → $6 is "one coffee for hours saved"
- Annual discount creates commitment

---

## Competitive Landscape

| Tool | Problem | Why HuntFlow Wins |
|------|---------|-------------------|
| Toggl | Generic time tracker | No security context, no templates |
| Notion | General notes | Heavy, slow, no offline-first, no gamification |
| Obsidian | Knowledge base | Overkill, steep learning curve, no report builder |
| HackerOne Dashboard | Platform-only | Doesn't track cross-platform, no productivity features |
| Forest App | Focus timer | No security workflow, no note-taking |

**Moat:** Domain-specific UX that generic tools can't replicate without becoming bloated.

---

## Success Metrics

| Metric | Target (Month 3) | Target (Month 12) |
|--------|------------------|-------------------|
| Weekly Active Users | 500 | 5,000 |
| Free-to-Pro Conversion | 3% | 5% |
| Day-7 Retention | 40% | 50% |
| Avg Session Duration | 8 min | 10 min |
| NPS Score | 30 | 50 |
| Report Builder Usage | 60% of Pro users | 75% |

---

## Roadmap

### Phase 1: MVP (Weeks 1-4)
- [ ] PWA scaffold with SvelteKit
- [ ] IndexedDB schema + offline-first architecture
- [ ] Focus timer with session logging
- [ ] Note templates (8 built-in)
- [ ] Target tracker
- [ ] Stats dashboard
- [ ] Installable PWA (web + Android)

### Phase 2: Polish (Weeks 5-6)
- [ ] UX refinement based on 5 hunter interviews
- [ ] Performance audit (<2s first paint on 3G)
- [ ] Export/Import JSON backup
- [ ] Dark mode

### Phase 3: Pro Launch (Weeks 7-10)
- [ ] Auth + cloud sync
- [ ] Report builder (markdown generation)
- [ ] Income tracker
- [ ] Stripe integration
- [ ] Landing page + waitlist

### Phase 4: Growth (Months 4-6)
- [ ] Team collaboration
- [ ] Browser extension (save payloads from write-ups)
- [ ] API for power users
- [ ] Affiliate program for security influencers

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Hunters don't want to pay | Medium | High | Strong free tier, clear time-saving value prop |
| Too niche, small market | Low | Medium | Expand to penetration testers, CTF players |
| Performance issues on low-end devices | Medium | High | Aggressive bundle splitting, lazy loading, IndexedDB optimization |
| Data loss fears | Medium | High | Automatic local backups, clear export functionality |
| Platform competition | Low | Medium | Move fast, community-driven feature requests |

---

## Brand & Voice

- **Tone:** Hacker-friendly, no corporate fluff, respectful of skill levels
- **Language:** Technical but accessible, emoji-friendly
- **Community:** Transparent roadmap, public GitHub issues, hunter spotlights
- **Taglines:**
  - "Hunt smarter. Stay consistent. Get paid."
  - "The only productivity app that understands bug bounties."
  - "From recon to report — one flow."

---

## Open Questions

1. Should we integrate with HackerOne/Bugcrowd APIs for auto-importing program scopes?
2. Is there demand for a "bounty alert" feature (new programs matching your skills)?
3. Should we offer a lifetime deal for early adopters?
4. Do hunters want public profiles to showcase their stats (like GitHub contributions)?

---

*Last updated: 2026-04-24*
*Status: MVP Planning Phase*
