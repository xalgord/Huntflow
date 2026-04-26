# MVP Features — HuntFlow

> **Version:** 1.0  
> **Goal:** Ship a functional, offline-first PWA that bug bounty hunters can use daily.  
> **Timeline:** 4 weeks (solo developer)  
> **Success Criteria:** 10 hunters use it daily for 7+ consecutive days.

---

## Sprint Overview

| Sprint | Focus | Duration | Deliverable |
|--------|-------|----------|-------------|
| **Sprint 0** | Foundation | Days 1-3 | Project scaffold, IndexedDB layer, PWA config |
| **Sprint 1** | Focus Timer | Days 4-7 | Session creation, timer, streaks, stats |
| **Sprint 2** | Notes & Targets | Days 8-14 | Note templates, target tracker, linking |
| **Sprint 3** | Dashboard & Polish | Days 15-18 | Stats dashboard, UX refinement, dark mode |
| **Sprint 4** | Ship Prep | Days 19-21 | Performance audit, bug fixes, landing page |
| **Buffer** | — | Days 22-28 | User testing, iteration, unexpected issues |

---

## Feature 1: Focus Timer (The Core Loop)

### User Story
> As a bug bounty hunter, I want to start a timed hunting session so that I can stay focused and track my consistency.

### Acceptance Criteria

#### 1.1 Session Creation
- [ ] User can tap "New Session" from dashboard
- [ ] User selects a target from existing list OR creates a new target inline
- [ ] User can optionally select a vulnerability template (e.g., "SSRF")
- [ ] User can set session duration: 15min, 25min (default), 45min, 60min, Custom
- [ ] Session starts immediately after creation

#### 1.2 Timer Interface
- [ ] Large, readable countdown timer (MM:SS)
- [ ] Circular progress ring around timer
- [ ] Target name displayed below timer
- [ ] Current template icon displayed
- [ ] Three actions: Pause, Abandon, Complete Early
- [ ] Background timer: continues if app is backgrounded (via Service Worker + `setInterval` in SW)

#### 1.3 Timer States
```
IDLE → RUNNING → PAUSED → RUNNING → COMPLETED
                ↓
             ABANDONED
```
- **IDLE:** Ready to start
- **RUNNING:** Counting down, notification at 1 minute remaining
- **PAUSED:** Timer frozen, "Resume" button shown
- **COMPLETED:** Full duration elapsed, auto-prompt for session notes
- **ABANDONED:** User tapped "Abandon" before 50% completion (not counted in stats)

#### 1.4 Session Completion Flow
- [ ] On completion, modal opens: "Session Complete! 🎯"
- [ ] Quick note input (optional): "What did you find?"
- [ ] Tag selector: #critical, #high, #medium, #low, #needs-report, #duplicate
- [ ] "Save Session" button
- [ ] Auto-redirect to dashboard with updated stats

#### 1.5 Session History
- [ ] List of all sessions, newest first
- [ ] Filter by: Today, This Week, This Month, All Time
- [ ] Each session card shows: target, duration, status, tags
- [ ] Tap to view full session details
- [ ] Swipe to delete (with confirmation)

### Technical Spec

```typescript
// Session Store (Svelte Writable)
interface Session {
  id: string;                    // crypto.randomUUID()
  targetId: string;
  templateId?: string;
  durationPlanned: number;       // seconds
  durationActual: number;        // seconds
  startedAt: number;             // Date.now()
  endedAt?: number;
  status: 'running' | 'paused' | 'completed' | 'abandoned';
  quickNote?: string;
  tags: string[];
}

// Timer Logic
// - Use Date.now() timestamps, NOT setInterval for accuracy
// - Calculate remaining: (startedAt + durationPlanned * 1000) - Date.now()
// - Update UI every 1s via requestAnimationFrame or setInterval(1000)
// - Background: Store endTime in IndexedDB, check on visibilitychange
```

### UI Mock
```
┌─────────────────────────────┐
│  ← Back          [Settings] │
│                             │
│      ┌───────────┐          │
│     /   24:37    \         │
│    │   ████████   │         │
│     \            /          │
│      └───────────┘          │
│                             │
│   Target: example.com       │
│   Template: SSRF            │
│                             │
│   [  Pause  ]  [ Abandon ] │
│                             │
│   Session #42  |  Streak: 5│
└─────────────────────────────┘
```

---

## Feature 2: Target Tracker

### User Story
> As a bug bounty hunter, I want to track which programs I'm hunting, their scope, and my progress so that I don't lose track of active targets.

### Acceptance Criteria

#### 2.1 Create Target
- [ ] Tap "+" to add new target
- [ ] Fields:
  - Name (required): e.g., "Example Corp"
  - Platform (dropdown): HackerOne, Bugcrowd, Intigriti, Synack, YesWeHack, Self-Hosted, Other
  - Program URL (optional): link to program page
  - Scope (textarea): list of in-scope domains/URLs
  - Notes (textarea): general notes about the program
  - Priority: P0 (🔥), P1, P2, P3
- [ ] Save to IndexedDB instantly

#### 2.2 Target List
- [ ] Card-based list, sorted by priority then last activity
- [ ] Each card shows:
  - Name + Platform icon
  - Priority badge
  - Status: Recon / Testing / Reported / Paid / Closed
  - Last session date
  - Session count
- [ ] Filter by: Platform, Priority, Status
- [ ] Search by name

#### 2.3 Target Detail View
- [ ] Full target info editable inline
- [ ] List of all sessions for this target
- [ ] Quick action: "Start Session" (pre-fills target)
- [ ] Status progression: Recon → Testing → Reported → Paid → Closed
- [ ] Archive option (hides from main list, viewable in "Archived")

#### 2.4 Target Status
| Status | Meaning | How to Set |
|--------|---------|-----------|
| Recon | Just started, gathering info | Default on creation |
| Testing | Actively finding bugs | Auto-set on first session |
| Reported | Submitted findings | Manual |
| Paid | Received payout | Manual |
| Closed | Done with program | Manual |
| Archived | No longer hunting | Manual |

### Data Model
```typescript
interface Target {
  id: string;
  name: string;
  platform: 'hackerone' | 'bugcrowd' | 'intigriti' | 'synack' | 'yeswehack' | 'self-hosted' | 'other';
  programUrl?: string;
  scope: string;
  notes: string;
  priority: 0 | 1 | 2 | 3;
  status: 'recon' | 'testing' | 'reported' | 'paid' | 'closed' | 'archived';
  createdAt: number;
  updatedAt: number;
  lastSessionAt?: number;
  sessionCount: number;
}
```

---

## Feature 3: Quick Notes with Templates

### User Story
> As a bug bounty hunter, I want to take structured notes during my sessions so that I can later generate reports without trying to remember what I did.

### Acceptance Criteria

#### 3.1 Note Creation
- [ ] Create note from: Dashboard, Session completion, Target detail
- [ ] Select template OR start blank
- [ ] Title (auto-generated from template if blank)
- [ ] Rich text editor: markdown support, code blocks, bullet lists
- [ ] Link to target (required)
- [ ] Link to session (optional, auto-linked if created during session)

#### 3.2 Built-in Templates (8)

**Template: Subdomain Takeover**
```
Vulnerable Subdomain:
Affected Service (e.g., Heroku, AWS S3, GitHub Pages):
Proof of Takeover:
Impact:
Remediation:
```

**Template: IDOR**
```
Vulnerable Endpoint:
Parameter:
Normal Request (authorized):
Modified Request (unauthorized):
Response Difference:
Impact:
Remediation:
```

**Template: SSRF**
```
Vulnerable Endpoint:
Payload Used:
Internal Service Accessed:
Data Exfiltrated:
Impact:
Remediation:
```

**Template: SQL Injection**
```
Vulnerable Endpoint:
Parameter:
Payload:
Database Type (if identified):
Proof (error message / time delay / data extraction):
Impact:
Remediation:
```

**Template: XSS**
```
Vulnerable Endpoint:
Parameter/Location:
Payload:
Context (reflected/stored/DOM):
WAF Bypass (if any):
Impact:
Remediation:
```

**Template: Authentication Bypass**
```
Vulnerable Endpoint:
Bypass Technique:
Normal Flow:
Bypassed Flow:
Impact:
Remediation:
```

**Template: Information Disclosure**
```
Source Endpoint:
Sensitive Data Exposed:
Exposure Method (error message / API / file):
Impact:
Remediation:
```

**Template: Business Logic Flaw**
```
Affected Feature:
Intended Behavior:
Actual Behavior:
Attack Scenario:
Financial Impact (if any):
Remediation:
```

#### 3.3 Note Editor
- [ ] Textarea with markdown preview toggle
- [ ] Toolbar: Bold, Italic, Code, Code Block, Link, Bullet List, Numbered List
- [ ] Auto-save every 3 seconds (local only)
- [ ] "Save" button explicitly commits
- [ ] Character count
- [ ] Tags input (comma-separated, auto-suggest existing tags)

#### 3.4 Note List
- [ ] All notes, newest first
- [ ] Filter by: Target, Template, Tag
- [ ] Search full-text
- [ ] Card view: title, target, template badge, tags, last edited
- [ ] Tap to edit

#### 3.5 Note-to-Session Linking
- [ ] When creating note during session completion, auto-link
- [ ] Session detail shows linked notes
- [ ] Note detail shows linked session

### Data Model
```typescript
interface Note {
  id: string;
  title: string;
  content: string;           // markdown
  targetId: string;
  sessionId?: string;
  templateId?: string;       // references built-in or custom template
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

interface NoteTemplate {
  id: string;
  name: string;
  category: string;          // e.g., "web", "mobile", "api"
  content: string;           // template body with {{placeholders}}
  isBuiltIn: boolean;
  isCustom?: boolean;        // user-created (Pro feature)
}
```

---

## Feature 4: Stats Dashboard

### User Story
> As a bug bounty hunter, I want to see my hunting stats so that I can stay motivated and identify patterns in my work.

### Acceptance Criteria

#### 4.1 Dashboard Layout
- [ ] Single-page scrollable dashboard
- [ ] Top section: Today's summary + current streak
- [ ] Middle section: Weekly activity calendar
- [ ] Bottom section: Charts + insights

#### 4.2 Today's Summary Card
- [ ] Hunting time today (HH:MM)
- [ ] Sessions completed today
- [ ] Current streak (🔥 N days)
- [ ] Best streak (🏆 N days)
- [ ] Quick action: "Start Session"

#### 4.3 Weekly Calendar (GitHub-style)
- [ ] 7-day row: Mon-Sun
- [ ] Each day: color intensity based on hunting minutes
  - 0 min: empty
  - 1-15 min: light green
  - 16-45 min: medium green
  - 46-90 min: dark green
  - 90+ min: intense green
- [ ] Tap day to see sessions from that day

#### 4.4 Stats Cards
- [ ] **Total Hunting Time** (all time, this month, this week)
- [ ] **Sessions by Vulnerability Type** (pie chart or bar chart)
- [ ] **Target Progress** (active vs. completed vs. archived)
- [ ] **Average Session Length** (trend over time)
- [ ] **Most Active Time** (morning/afternoon/evening/night)

#### 4.5 Insights (Simple Heuristics)
- [ ] "You've hunted 3 days in a row! 🔥"
- [ ] "Your average session is 32 minutes — try 45min for deeper focus"
- [ ] "You've spent 12 hours on XSS — you're becoming a specialist!"
- [ ] "No hunting in 2 days — your streak is at risk!"

### Technical Spec
```typescript
// Stats computed on-the-fly from session store
// No separate stats table — derive from sessions

interface DailyStats {
  date: string;              // YYYY-MM-DD
  totalMinutes: number;
  sessionCount: number;
  completedCount: number;
}

function computeStreak(sessions: Session[]): number {
  // Sort by date descending
  // Count consecutive days with ≥1 completed session
  // Stop at first gap
}

function computeStats(sessions: Session[]) {
  return {
    totalTime: sum(durationActual where status === 'completed'),
    totalSessions: count(),
    completedSessions: count(status === 'completed'),
    abandonedSessions: count(status === 'abandoned'),
    avgSessionLength: mean(durationActual),
    streak: computeStreak(),
    bestStreak: max(all time streaks),
    byVulnType: groupBy(templateId),
    byTarget: groupBy(targetId),
    byHour: groupBy(hourOfDay(startedAt))
  };
}
```

### Chart Library Decision
**Winner: Chart.js (lightweight build)**
- ~60KB gzipped (tree-shakeable)
- Canvas-based (fast, no DOM manipulation)
- Simple API
- Alternatives rejected:
  - D3: Too heavy (~300KB), overkill for 4 charts
  - Recharts: React-only
  - ApexCharts: Heavy animations, memory hungry

---

## Feature 5: Offline-First Architecture

### User Story
> As a bug bounty hunter, I want the app to work without internet so that I can hunt anywhere, anytime.

### Acceptance Criteria

#### 5.1 Service Worker
- [ ] Caches static assets on install
- [ ] Serves app shell from cache (instant load)
- [ ] Network-first for API calls (when online)
- [ ] Cache-first for static assets
- [ ] Background sync for data changes
- [ ] Shows "Offline Mode" banner when disconnected

#### 5.2 IndexedDB Layer
- [ ] Abstracted DB class with CRUD operations
- [ ] All reads/writes are async
- [ ] Error handling with fallback to memory
- [ ] DB versioning with migration support

#### 5.3 Data Persistence
- [ ] Sessions: auto-saved every 10 seconds during timer
- [ ] Notes: auto-saved every 3 seconds while editing
- [ ] Targets: saved on every field change (debounced 500ms)
- [ ] Settings: saved immediately

#### 5.4 Export/Import
- [ ] "Export Data" button: downloads JSON file with all data
- [ ] "Import Data" button: uploads JSON, validates schema, merges or replaces
- [ ] Export includes: sessions, notes, targets, templates, settings

#### 5.5 Connectivity Handling
- [ ] Detect online/offline via `navigator.onLine`
- [ ] Visual indicator: green dot (online), red dot (offline)
- [ ] Queue actions for sync when back online
- [ ] Toast notification: "You're back online! Syncing..."

### IndexedDB Schema (Detailed)
```javascript
const DB_NAME = 'huntflow';
const DB_VERSION = 1;

const schema = {
  sessions: {
    keyPath: 'id',
    indexes: [
      { name: 'targetId', keyPath: 'targetId', unique: false },
      { name: 'startedAt', keyPath: 'startedAt', unique: false },
      { name: 'status', keyPath: 'status', unique: false }
    ]
  },
  notes: {
    keyPath: 'id',
    indexes: [
      { name: 'targetId', keyPath: 'targetId', unique: false },
      { name: 'sessionId', keyPath: 'sessionId', unique: false },
      { name: 'templateId', keyPath: 'templateId', unique: false },
      { name: 'tags', keyPath: 'tags', multiEntry: true },
      { name: 'updatedAt', keyPath: 'updatedAt', unique: false }
    ]
  },
  targets: {
    keyPath: 'id',
    indexes: [
      { name: 'platform', keyPath: 'platform', unique: false },
      { name: 'status', keyPath: 'status', unique: false },
      { name: 'priority', keyPath: 'priority', unique: false },
      { name: 'updatedAt', keyPath: 'updatedAt', unique: false }
    ]
  },
  templates: {
    keyPath: 'id',
    indexes: [
      { name: 'category', keyPath: 'category', unique: false }
    ]
  },
  settings: {
    keyPath: 'key'
  }
};
```

---

## Feature 6: PWA & Installability

### User Story
> As a bug bounty hunter, I want to install this app on my phone's home screen so that it feels like a native app.

### Acceptance Criteria

#### 6.1 Web App Manifest
- [ ] `manifest.json` with:
  - App name: "HuntFlow"
  - Short name: "HuntFlow"
  - Icons: 192x192, 512x512 (PNG)
  - Theme color: `#0f172a` (dark slate)
  - Background color: `#0f172a`
  - Display: `standalone`
  - Orientation: `portrait-primary`

#### 6.2 Icons
- [ ] Simple, recognizable icon (crosshair + bug or target symbol)
- [ ] Adaptive icons for Android (foreground + background layers)
- [ ] Maskable icon support

#### 6.3 Installation Prompt
- [ ] Custom "Add to Home Screen" banner (not browser default)
- [ ] Shows on 2nd visit (not immediate, not too aggressive)
- [ ] Dismissible, remembers choice

#### 6.4 Android Experience
- [ ] Status bar color matches app theme
- [ ] No browser chrome in standalone mode
- [ ] Pull-to-refresh disabled (or customized)
- [ ] Back button handling (navigates back, exits on root)
- [ ] Splash screen on launch

#### 6.5 iOS Experience
- [ ] Apple touch icon
- [ ] `apple-mobile-web-app-capable: yes`
- [ ] `apple-mobile-web-app-status-bar-style: black-translucent`
- [ ] Safe area insets handled (notch, home indicator)

---

## Feature 7: Settings & Preferences

### User Story
> As a bug bounty hunter, I want to customize the app to my workflow so that it feels like mine.

### Acceptance Criteria

#### 7.1 Timer Settings
- [ ] Default session duration: 15/25/45/60 min
- [ ] Auto-start break timer: on/off
- [ ] Break duration: 5/10/15 min
- [ ] Long break after N sessions: 3/4/5
- [ ] Sound notifications: on/off
- [ ] Vibration: on/off (mobile)

#### 7.2 Appearance
- [ ] Theme: Light / Dark / System
- [ ] Accent color: Blue / Green / Orange / Purple
- [ ] Font size: Small / Medium / Large

#### 7.3 Data
- [ ] Export all data (JSON)
- [ ] Import data (JSON)
- [ ] Clear all data (with confirmation)
- [ ] Storage usage indicator

#### 7.4 About
- [ ] App version
- [ ] "What's New" changelog
- [ ] Feedback link
- [ ] Privacy policy (minimal, transparent)

---

## Non-Functional Requirements

### Performance
- [ ] First paint < 1.5s on 3G
- [ ] Time to interactive < 3s
- [ ] Timer UI updates every 1s without jank
- [ ] Note list scrolls at 60fps (virtual scroll if >100 notes)
- [ ] App size < 200KB (initial bundle)

### Accessibility
- [ ] All interactive elements keyboard accessible
- [ ] ARIA labels on all icons/buttons
- [ ] Color contrast WCAG AA compliant
- [ ] Screen reader friendly (test with NVDA/VoiceOver)
- [ ] Focus visible states

### Reliability
- [ ] No data loss on app crash (auto-save every 3s)
- [ ] Graceful degradation if IndexedDB fails (memory fallback + warning)
- [ ] Service worker doesn't break on update (skipWaiting strategy)
- [ ] App works after being closed for days (state restoration)

### Browser Support
| Browser | Support Level |
|---------|--------------|
| Chrome 90+ | Full |
| Firefox 90+ | Full |
| Safari 14+ | Full (iOS 14+) |
| Edge 90+ | Full |
| Samsung Internet | Best effort |
| Opera | Best effort |

---

## Out of Scope (Post-MVP)

These are explicitly NOT in the MVP. They go in the backlog.

| Feature | Why Deferred |
|---------|-------------|
| Cloud sync | Requires backend, auth, infrastructure |
| Report builder | Complex template engine, needs user feedback first |
| Income tracker | Requires backend, payment platform APIs |
| Team collaboration | Multi-user, permissions, real-time sync |
| Browser extension | Separate codebase, distribution complexity |
| Custom templates | Pro feature, needs template builder UI |
| Push notifications | Requires backend + notification service |
| AI suggestions | Heavy dependency, unclear value |
| Public profiles | Social features, moderation overhead |
| Platform API integration | OAuth complexity, limited API access |
| Desktop app (Electron/Tauri) | PWA is sufficient for MVP |

---

## Definition of Done

A feature is "done" when:
- [ ] Code is written and self-reviewed
- [ ] Works offline (tested with DevTools "Offline" mode)
- [ ] Works on mobile (tested in responsive mode, 375px width)
- [ ] No console errors
- [ ] Lighthouse score ≥ 90 (Performance, Accessibility, Best Practices, PWA)
- [ ] Added to CHANGELOG.md

The MVP is "done" when:
- [ ] All 7 features above are done
- [ ] 3 bug bounty hunters have used it for 7+ consecutive days
- [ ] No P0 or P1 bugs
- [ ] Landing page is live
- [ ] App is installable on Android

---

*Let's build this. 🎯*

*Last updated: 2026-04-24*
