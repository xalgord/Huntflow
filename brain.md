# Brain.md — HuntFlow Architecture & Decision Log

> **Purpose:** This document captures the reasoning, trade-offs, patterns, and mental models behind HuntFlow. It exists so that future-you (or future-contributors) understand *why* things are the way they are, not just *what* they are.

---

## Table of Contents
1. [Core Philosophy](#core-philosophy)
2. [Why Offline-First?](#why-offline-first)
3. [Framework Choice: SvelteKit](#framework-choice-sveltekit)
4. [Database: IndexedDB + PostgreSQL](#database-indexeddb--postgresql)
5. [The "Session" as the Atomic Unit](#the-session-as-the-atomic-unit)
6. [Gamification Design](#gamification-design)
7. [Report Builder Architecture](#report-builder-architecture)
8. [Sync Strategy](#sync-strategy)
9. [Security Model](#security-model)
10. [Performance Budget](#performance-budget)
11. [Naming Conventions](#naming-conventions)
12. [Anti-Patterns We Avoid](#anti-patterns-we-avoid)
13. [Decision Log](#decision-log)

---

## Core Philosophy

### 1. "The Hunter's Context Switch is Expensive"
Every time a hunter opens a new tab, switches apps, or waits for a page to load, they lose flow state. HuntFlow must be:
- **Instant** — <100ms interaction response
- **Predictable** — Same UI patterns everywhere
- **Context-preserving** — Never throw away unsaved work

### 2. "Offline is Not a Feature, It's a Constraint"
We don't "support" offline. We assume the user is offline by default and treat connectivity as an optimization. This flips the mental model:
- Write to local first, always
- Sync is a background process, not a gate
- The app must feel complete without the internet

### 3. "Subscription Value Must Be Obvious in 5 Minutes"
A hunter should upgrade to Pro not because they're locked out, but because they *want* the time savings. Free tier must be genuinely useful. Pro must feel like a superpower.

### 4. "2GB RAM is the Target, Not the Minimum"
Design for the constraint. If it runs well on a 2GB Android phone from 2019, it flies on modern hardware. This forces discipline:
- No heavy frameworks
- No unnecessary animations
- No memory leaks in long-running sessions

---

## Why Offline-First?

### The Hunter's Environment
Bug bounty hunters work in unusual network conditions:
- Coffee shop WiFi with captive portals
- VPN tunnels that drop
- Air-gapped testing environments
- Mobile hotspots with data caps
- Countries with unstable infrastructure

### Technical Benefits
| Benefit | Explanation |
|---------|-------------|
| **Speed** | Local reads are ~10ms vs ~200ms network roundtrip |
| **Reliability** | App never "breaks" when connectivity drops |
| **Battery** | No constant radio usage for trivial operations |
| **Privacy** | Sensitive recon data never leaves device unless user chooses |

### The Trade-Off
**Complexity.** Sync is hard. Conflict resolution is harder. We accept this because the alternative (always-online) disqualifies us from our core use case.

### Implementation Pattern
```
User Action → IndexedDB Write (instant) → Background Sync Queue → API (when online)
                                      ↓
                                Optimistic UI Update
```

---

## Framework Choice: SvelteKit

### Why Not React?
React is the default, but it's wrong for this project:
- **Bundle size:** React + ReactDOM = ~40KB gzipped. Svelte compiles to vanilla JS.
- **Runtime overhead:** React's virtual DOM adds memory pressure. Svelte has no virtual DOM.
- **Complexity:** Hooks, context, state management libraries add cognitive load.
- **PWA support:** SvelteKit has first-class PWA support via Vite plugin.

### Why Not Vue?
Vue is closer, but:
- Svelte's compiled output is smaller
- SvelteKit's file-based routing is simpler for an MVP
- Svelte's reactivity model (assignments trigger updates) is more intuitive

### Why Not Vanilla JS?
We need routing, code splitting, and PWA scaffolding. SvelteKit gives us this with minimal overhead.

### The Real Reason
**Developer velocity.** A solo developer (or small team) can ship faster with SvelteKit's conventions than configuring a React toolchain. Time-to-market beats theoretical perfection.

---

## Database: IndexedDB + PostgreSQL

### IndexedDB Schema (Client)

```javascript
// Object Stores
const stores = {
  sessions: {
    keyPath: 'id',
    indexes: ['targetId', 'startedAt', 'status']
  },
  notes: {
    keyPath: 'id', 
    indexes: ['targetId', 'template', 'tags', 'createdAt']
  },
  targets: {
    keyPath: 'id',
    indexes: ['platform', 'status', 'priority']
  },
  templates: {
    keyPath: 'id',
    indexes: ['category']
  },
  syncQueue: {
    keyPath: 'id',
    indexes: ['entityType', 'status', 'timestamp']
  },
  settings: {
    keyPath: 'key'
  }
};
```

### Why IndexedDB Over LocalStorage?
| Feature | LocalStorage | IndexedDB |
|---------|-------------|-----------|
| Storage limit | ~5MB | ~50MB+ (browser-dependent) |
| Data types | Strings only | Structured objects, blobs |
| Performance | Synchronous (blocks main thread) | Asynchronous |
| Indexing | None | Full index support |
| Transactions | None | ACID transactions |

LocalStorage is fine for settings. IndexedDB is mandatory for notes, sessions, and targets.

### PostgreSQL Schema (Server)

```sql
-- Users (managed by Lucia Auth)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    subscription_status TEXT DEFAULT 'free', -- free, pro, team
    subscription_expires_at TIMESTAMPTZ
);

-- Synced entities mirror client schema
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    target_id UUID,
    started_at TIMESTAMPTZ NOT NULL,
    duration_seconds INT,
    notes TEXT,
    status TEXT DEFAULT 'completed',
    client_created_at TIMESTAMPTZ, -- for conflict resolution
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conflict resolution log
CREATE TABLE sync_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    server_version JSONB,
    client_version JSONB,
    resolved_at TIMESTAMPTZ,
    resolution TEXT -- 'server', 'client', 'merged'
);
```

### Why PostgreSQL?
- Relational data (users, sessions, notes) maps naturally to tables
- JSONB columns handle flexible note content without schema migrations
- Battle-tested, well-understood by most developers
- Cheap to host (Railway/Render free tier is sufficient for MVP)

---

## The "Session" as the Atomic Unit

### Mental Model
Everything in HuntFlow revolves around the **Session** — a timed block of focused hunting. This is intentional:

- A session has a **target** (what you're hunting)
- A session can have **notes** (what you found)
- A session has a **duration** (how long you hunted)
- A session contributes to **streaks** (consistency)

### Why Not "Note-First"?
Notes are passive. Sessions are active. By centering on sessions, we:
1. Encourage time-boxed hunting (Pomodoro prevents rabbit holes)
2. Create natural data for the stats dashboard
3. Make gamification obvious ("You hunted 5 hours this week!")

### Session Lifecycle
```
CREATED → RUNNING → PAUSED → COMPLETED
                    ↓
                   ABANDONED
```

- **CREATED:** Timer initialized, target selected
- **RUNNING:** Active countdown
- **PAUSED:** User hit pause (counts as interruption, logged for insights)
- **COMPLETED:** Full duration elapsed, hunter logs findings
- **ABANDONED:** Timer stopped early (<50% duration), not counted toward stats

### Session Data Model
```typescript
interface Session {
  id: string;           // UUID v4
  targetId: string;     // Link to target
  template: string;     // e.g., "ssrf", "idor"
  startedAt: Date;
  endedAt: Date;
  durationPlanned: number;  // seconds (e.g., 1500 for 25min)
  durationActual: number;   // seconds (may be less if abandoned)
  status: 'completed' | 'abandoned' | 'paused';
  notes: Note[];        // Inline notes taken during session
  tags: string[];       // e.g., ["critical", "needs-report"]
  mood?: number;        // 1-5 post-session reflection (future feature)
}
```

---

## Gamification Design

### Why Gamification Matters for Bug Bounty
Bug bounty hunting is:
- **High variance:** Weeks of nothing, then one big payout
- **Solo work:** No team cheering you on
- **Demotivating:** Rejection is common (duplicates, N/A, informative)

Gamification provides **extrinsic motivation** during the dry spells until **intrinsic motivation** (the payout) kicks in.

### HuntFlow's Gamification Stack

#### 1. Streaks
- **Daily Streak:** Consecutive days with ≥1 completed session
- **Weekly Streak:** Consecutive weeks with ≥3 hunting days
- **Visual:** Calendar heatmap (like GitHub contributions)
- **Psychology:** Loss aversion — breaking a 20-day streak hurts

#### 2. Stats That Matter
| Stat | Why It Motivates |
|------|-----------------|
| Total Hunting Hours | "I've invested 100 hours — I'm getting closer" |
| Sessions by Vuln Type | "I'm becoming an XSS specialist" |
| Target Completion Rate | "I finish what I start" |
| Average Session Length | "My focus is improving" |

#### 3. Milestones (Future)
- "First 10 Hours"
- "7-Day Streak"
- "First Report Submitted"
- "100 Hours Logged"

#### 4. Anti-Patterns We Avoid
- ❌ Leaderboards (bug bounty is competitive enough, this creates toxicity)
- ❌ Points/coins (fake currency feels patronizing to professionals)
- ❌ Punishment for missed days (guilt is demotivating)
- ✅ Focus on **personal progress**, not comparison

---

## Report Builder Architecture

### The Problem
Writing a bug bounty report takes 30-60 minutes. The structure is repetitive:
1. Title
2. Severity
3. Summary
4. Steps to Reproduce
5. Impact
6. Proof of Concept
7. Remediation

### The Solution
Auto-generate a markdown report from session notes using templates.

### Data Flow
```
Session Notes (structured) 
    ↓
[Template Engine] — merges notes into platform-specific format
    ↓
Markdown Report
    ↓
[Export] — .md, .pdf, or copy to clipboard
```

### Template System

```typescript
interface ReportTemplate {
  id: string;
  name: string;           // "HackerOne Standard"
  platform: string;       // "hackerone" | "bugcrowd" | "intigriti" | "custom"
  sections: ReportSection[];
}

interface ReportSection {
  id: string;
  title: string;
  source: 'auto' | 'manual';     // auto = pulled from notes
  mapping?: string;              // which note field to use
  defaultContent?: string;
  required: boolean;
}

// Example: HackerOne Template
const hackerOneTemplate: ReportTemplate = {
  id: 'h1-standard',
  name: 'HackerOne Standard',
  platform: 'hackerone',
  sections: [
    { id: 'title', title: 'Title', source: 'manual', required: true },
    { id: 'severity', title: 'Severity', source: 'auto', mapping: 'severity', required: true },
    { id: 'summary', title: 'Summary', source: 'auto', mapping: 'summary', required: true },
    { id: 'steps', title: 'Steps to Reproduce', source: 'auto', mapping: 'reproductionSteps', required: true },
    { id: 'impact', title: 'Impact', source: 'auto', mapping: 'impact', required: true },
    { id: 'poc', title: 'Proof of Concept', source: 'auto', mapping: 'proofOfConcept', required: false },
    { id: 'remediation', title: 'Remediation', source: 'auto', mapping: 'remediation', required: false }
  ]
};
```

### Note-to-Report Mapping
When a hunter uses a note template (e.g., "SSRF"), the template has predefined fields:

```typescript
interface SSRFNote extends Note {
  fields: {
    vulnerableEndpoint: string;
    payload: string;
    internalServiceAccessed: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    impact: string;
    reproductionSteps: string[];
    proofOfConcept: string;
    remediation: string;
  }
}
```

These fields map directly to report sections. The hunter fills them during the session (when context is fresh), and the report builder assembles them later.

### Why Markdown?
- Universal format accepted by all platforms
- Hunters can paste and edit before submission
- Lightweight generation (no heavy PDF libraries on client)
- PDF generation happens server-side (Pro feature) using libraries like `markdown-pdf` or `puppeteer`

---

## Sync Strategy

### The Hard Problem
Two devices, same user, offline changes on both. How do we merge?

### Our Approach: "Last Write Wins" + Manual Merge

For MVP, we keep it simple:

```
Every entity has:
  - updatedAt (client timestamp)
  - version (incrementing integer)

Sync Algorithm:
  1. Client sends local changes with version numbers
  2. Server compares with server version
  3. If server.version == client.version - 1: accept
  4. If server.version > client.version: CONFLICT
  5. On conflict: server wins, client gets conflict notification
  6. User manually resolves in "Sync Conflicts" UI
```

### Why Not CRDTs?
Conflict-free Replicated Data Types (CRDTs) are elegant but:
- Overkill for text notes (operational transforms are complex)
- Hard to debug
- Most conflicts are simple: user edited same note on phone and laptop

### Future: Smart Merge
For text fields, we could implement a simple diff UI:
- Show server version vs. client version side-by-side
- User picks which to keep, or edits a merged version

### Sync Queue Design
```typescript
interface SyncQueueItem {
  id: string;
  entityType: 'session' | 'note' | 'target';
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload: object;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed' | 'resolved';
}
```

The sync queue is processed:
1. On app startup (if online)
2. When connectivity is restored (via `navigator.onLine` + `online` event)
3. Periodically every 30 seconds (if queue is non-empty)

### Handling Large Payloads
Notes with screenshots or large code blocks could exceed IndexedDB limits. Strategy:
- Text stored in IndexedDB
- Attachments (images) stored as blobs with a size limit (5MB per note)
- Large attachments deferred to background upload

---

## Security Model

### Threat Model
HuntFlow stores sensitive data:
- Recon notes (subdomains, endpoints)
- Vulnerability details (pre-disclosure)
- Income information
- Target lists (which companies you're hacking)

### Client-Side Security
1. **All data encrypted at rest** using IndexedDB's native encryption (browser-level)
2. **No sensitive data in URLs** (no target names in routes)
3. **Auto-lock** after 5 minutes of inactivity (optional, Pro feature)
4. **Biometric auth** on Android (WebAuthn / Fingerprint API)

### Server-Side Security
1. **Row-level security** in PostgreSQL (users can only access their own data)
2. **JWT sessions** with short expiry (15 minutes) + refresh tokens
3. **Rate limiting** on sync API (prevent abuse)
4. **Input validation** — strict schemas, no raw SQL
5. **Audit logging** — track access patterns for suspicious activity

### The Paranoid Hunter
Some hunters will never trust cloud sync. That's fine:
- Free tier is fully offline
- Export/Import JSON works without an account
- We never auto-enable cloud sync — explicit opt-in only

---

## Performance Budget

### Hard Limits
| Metric | Target | Maximum |
|--------|--------|---------|
| Initial bundle | <150KB | 200KB |
| First paint | <1.5s | 2.5s |
| Time to interactive | <3s | 5s |
| Memory footprint | <100MB | 150MB |
| IndexedDB queries | <50ms | 100ms |
| Service worker install | <5s | 10s |

### Strategies
1. **Code splitting** — Route-based lazy loading
2. **Tree shaking** — Only import used icons from Lucide
3. **No external fonts** — System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI"`)
4. **No animation libraries** — CSS transitions only
5. **Virtual scrolling** — For long note/session lists
6. **Image optimization** — WebP, lazy loading, size limits

### Memory Management
- Clear completed sync queue items after 7 days
- Limit session history to 1000 entries (archive older to JSON export)
- Use `WeakMap` for ephemeral caches
- Monitor with `performance.memory` (Chrome) for leaks

---

## Naming Conventions

### Files
```
Components: PascalCase.svelte
  e.g., FocusTimer.svelte, NoteEditor.svelte

Stores: camelCase.store.ts
  e.g., sessionStore.ts, targetStore.ts

Utils: camelCase.ts
  e.g., idbHelper.ts, syncEngine.ts

Routes: kebab-case/+page.svelte
  e.g., dashboard/+page.svelte, settings/+page.svelte
```

### Database
```
Tables: snake_case, plural
  e.g., sessions, notes, targets

Columns: snake_case
  e.g., started_at, target_id

Foreign keys: singular_table_id
  e.g., user_id, session_id
```

### CSS Classes (Tailwind)
```
Use Tailwind utilities exclusively.
Custom components: kebab-case in <style>
  e.g., .timer-ring, .note-template
```

---

## Anti-Patterns We Avoid

### 1. "We'll Add It Later"
If a feature doesn't fit in the MVP, it goes in the backlog with a clear "why not now." No half-implemented features.

### 2. "Just Use a Library"
Every dependency is a liability. Before adding a library:
- Can we implement it in <50 lines?
- Is the library actively maintained?
- What's the bundle size impact?
- Do we need all its features?

### 3. "Mobile-Last"
Design mobile-first, then expand to desktop. Many hunters will use this on their phone during commutes or breaks.

### 4. "Feature Creep"
Every feature must pass the test: *"Does this help a hunter hunt more consistently or report faster?"* If no, it doesn't ship.

### 5. "Dark Patterns for Conversion"
No nag screens. No artificial limits that frustrate. No "your data will be deleted unless you upgrade." Free tier must remain genuinely useful forever.

---

## Decision Log

| Date | Decision | Context | Alternatives | Rationale |
|------|----------|---------|-------------|-----------|
| 2026-04-24 | SvelteKit over React | Framework choice | React, Vue, Solid | Smaller bundle, faster dev, PWA-native |
| 2026-04-24 | IndexedDB over LocalStorage | Client storage | LocalStorage, SQLite (via WASM) | Structured data, async, large capacity |
| 2026-04-24 | Pomodoro (25min) default | Session length | 45min, 60min, custom | Industry standard, proven focus duration |
| 2026-04-24 | Markdown reports | Report format | PDF-only, HTML | Universal, editable, lightweight |
| 2026-04-24 | No leaderboards | Gamification | Global rankings, public profiles | Prevents toxicity, maintains trust |
| 2026-04-24 | Stripe for payments | Billing | Paddle, LemonSqueezy, PayPal | Best API, global coverage, developer-friendly |
| 2026-04-24 | Railway for hosting | Backend hosting | AWS, DigitalOcean, Vercel | Simplest deploy, auto-scaling, free tier |
| 2026-04-24 | No native app (PWA only) | Platform | React Native, Flutter | Single codebase, instant updates, <2GB RAM friendly |
| 2026-04-24 | Lucia Auth over Auth0 | Authentication | Auth0, Clerk, Firebase Auth | Zero dependency cost, full control, privacy |
| 2026-04-24 | Last-write-wins sync | Conflict resolution | CRDTs, OT | Simple, debuggable, sufficient for MVP |

---

## Open Technical Questions

1. **Should we use a local-first framework like RxDB or Electric SQL?**
   - Pro: Built-in sync, conflict resolution
   - Con: Additional dependency, learning curve
   - Decision: Build custom first, migrate if pain is high

2. **How do we handle platform API integrations (HackerOne, Bugcrowd)?**
   - OAuth is complex and scopes are limited
   - Decision: Manual program entry for MVP, API integration in Phase 4

3. **Should reports be generated client-side or server-side?**
   - Client: Instant, works offline
   - Server: Better PDF generation, consistent formatting
   - Decision: Markdown client-side (instant), PDF server-side (Pro)

4. **What's our backup strategy for IndexedDB?**
   - Browser can clear IndexedDB on storage pressure
   - Decision: Weekly auto-export prompt, Google Drive/Dropbox integration (Pro)

5. **Do we need end-to-end encryption for cloud sync?**
   - Pro: Ultimate privacy
   - Con: Complex key management, password reset impossible
   - Decision: TLS in transit + encrypted at rest for MVP. E2EE as advanced Pro feature.

---

## Mental Models for Contributors

### "The Hunter is Offline"
Always ask: "Does this work if the user has no internet?" If no, rethink.

### "The Hunter is Tired"
Bug bounty is mentally exhausting. The UI must be predictable, forgiving, and fast. No surprises.

### "The Hunter is Paranoid"
Security researchers are the hardest users to earn trust from. Be transparent about data handling. Never collect more than needed.

### "The Hunter is Cheap (Until They're Not)"
Free tier must be good enough to build habit. Pro tier must save enough time to justify the cost in one report.

### "The Hunter is on a Budget Phone"
Test on a $100 Android device. If it's sluggish there, it's not shippable.

---

*This document is a living artifact. Update it when decisions change. Future you will thank present you.*

*Last updated: 2026-04-24*
