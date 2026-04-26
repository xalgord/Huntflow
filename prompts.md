# prompts.md — HuntFlow Vibe Coding Prompts

> **Purpose:** Copy-paste these prompts into your AI coding assistant. Each prompt includes the right context references so the AI generates exactly what you need without back-and-forth.

---

## How to Use These Prompts

1. **Open your AI assistant** (Cursor, Claude Code, GitHub Copilot Chat, etc.)
2. **Paste the relevant prompt** from below
3. **Attach the referenced MD files** as context (use @-mentions or paste them)
4. **Review the output** against the acceptance criteria in mvp.md

---

## 🏗️ Foundation Prompts

### Prompt 1: Project Scaffold
```
I need to scaffold a SvelteKit PWA called HuntFlow. 

Read these files for context:
- project.md (project overview)
- tech-spec.md (technical requirements)
- design-system.md (UI specs)

Generate:
1. Complete package.json with exact versions from tech-spec.md
2. vite.config.ts with PWA plugin configuration
3. svelte.config.js with adapter-static
4. tailwind.config.js with the custom theme from design-system.md
5. tsconfig.json
6. app.html with PWA meta tags
7. static/manifest.json
8. static/service-worker.ts with cache-first strategy
9. src/app.css with Tailwind directives and custom CSS variables
10. src/lib/types/index.ts with all interfaces from data-model.md

Follow tech-spec.md folder structure exactly. Use dark mode as default.
```

### Prompt 2: IndexedDB Layer
```
Build the complete IndexedDB layer for HuntFlow.

Read:
- data-model.md (all interfaces and schema)
- tech-spec.md (DB access patterns)

Generate these files:
1. src/lib/db/schema.ts — All TypeScript interfaces
2. src/lib/db/index.ts — DB initialization with idb
3. src/lib/db/sessions.ts — SessionDB class with CRUD + indexes
4. src/lib/db/targets.ts — TargetDB class with CRUD + indexes
5. src/lib/db/notes.ts — NoteDB class with CRUD + indexes
6. src/lib/db/templates.ts — TemplateDB with built-in templates seed
7. src/lib/db/settings.ts — SettingsDB with defaults
8. src/lib/db/export.ts — Export all data to JSON
9. src/lib/db/import.ts — Import data from JSON with validation

Requirements:
- Use the idb library (not raw IndexedDB API)
- Every entity gets a wrapper class with: getAll, getById, put, delete, getBy{Index}
- Auto-init on first use (lazy init pattern)
- Memory fallback if IndexedDB fails (with warning flag)
- Export includes meta.version = "1.0"
- Import validates schema before merging
```

### Prompt 3: Svelte Stores
```
Build all Svelte stores for HuntFlow.

Read:
- data-model.md (interfaces)
- tech-spec.md (store patterns)
- mvp.md (feature requirements)

Generate:
1. src/lib/stores/sessionStore.ts — Writable store with auto-IndexedDB persistence
2. src/lib/stores/targetStore.ts — Writable store with auto-IndexedDB persistence
3. src/lib/stores/noteStore.ts — Writable store with auto-IndexedDB persistence
4. src/lib/stores/settingsStore.ts — Writable store with defaults and persistence
5. src/lib/stores/statsStore.ts — Derived stores from sessionStore:
   - streakStore (current streak)
   - bestStreakStore
   - todayMinutesStore
   - totalTimeStore
   - avgSessionLengthStore
   - byVulnTypeStore
   - dailyStatsStore (last 30 days)
6. src/lib/stores/timerStore.ts — Timer state management (idle/running/paused/completed)

Requirements:
- All stores load from IndexedDB on first subscription
- All stores auto-save to IndexedDB on change (debounced 500ms)
- Stats are computed on-the-fly, never stored separately
- Timer store manages Date.now() based countdown (not setInterval counting)
- Export all stores from src/lib/stores/index.ts
```

---

## 🎯 Feature Prompts

### Prompt 4: Focus Timer Page
```
Build the Focus Timer page for HuntFlow.

Read:
- mvp.md (Feature 1: Focus Timer acceptance criteria)
- design-system.md (Timer UI spec, colors, animations)
- data-model.md (Session interface)
- tech-spec.md (Timer implementation details)

Generate:
1. src/routes/timer/+page.svelte — Full timer page
2. src/lib/components/timer/TimerRing.svelte — SVG circular progress ring
3. src/lib/components/timer/TimerControls.svelte — Start/Pause/Resume/Abandon/Complete buttons
4. src/lib/components/timer/SessionCompleteModal.svelte — Post-session note modal
5. src/lib/components/timer/TargetSelector.svelte — Inline target selection
6. src/lib/components/timer/TemplateSelector.svelte — Vulnerability template selection

Requirements:
- Timer uses Date.now() timestamps (no drift)
- Survives app backgrounding via localStorage endTime + visibilitychange
- 25min default, options: 15/25/45/60/Custom
- Ring animates with CSS stroke-dashoffset
- Large monospace time display (MM:SS)
- Shows target name and template below timer
- Session count and current streak below
- On complete: modal with quick note + tag selector
- On abandon: confirmation if >5min elapsed
- All buttons minimum 44x44px touch targets
- Sound notification on complete (Web Audio API, optional)
- Follow design-system.md colors exactly
```

### Prompt 5: Target Tracker
```
Build the Target Tracker for HuntFlow.

Read:
- mvp.md (Feature 2: Target Tracker)
- design-system.md (Card specs, priority colors, status colors)
- data-model.md (Target interface, Platform type, Priority type, TargetStatus)

Generate:
1. src/routes/targets/+page.svelte — Target list page
2. src/routes/targets/[id]/+page.svelte — Target detail page
3. src/lib/components/targets/TargetCard.svelte — Card for list view
4. src/lib/components/targets/TargetForm.svelte — Create/edit form
5. src/lib/components/targets/TargetStatusBadge.svelte — Status badge
6. src/lib/components/targets/PriorityBadge.svelte — P0-P3 priority badge
7. src/lib/components/targets/PlatformIcon.svelte — Platform icon mapping
8. src/lib/components/targets/TargetFilter.svelte — Filter by platform/status/priority
9. src/lib/components/targets/TargetSearch.svelte — Search by name

Requirements:
- Cards sorted by priority (P0 first) then last activity
- Each card shows: name, platform icon, priority badge, status, last session, session count
- Status pipeline: Recon → Testing → Reported → Paid → Closed → Archived
- Inline status change on detail page
- Archive action (moves to archived, hidden from main list)
- Form validation with error states from design-system.md
- Filter dropdowns with platform icons
- Search debounced 300ms
- Empty state with icon + CTA button
- Follow design-system.md exactly
```

### Prompt 6: Notes System
```
Build the Notes system for HuntFlow.

Read:
- mvp.md (Feature 3: Quick Notes with Templates)
- design-system.md (Note editor UI, markdown preview styling)
- data-model.md (Note interface, NoteTemplate interface, BUILT_IN_TEMPLATES)

Generate:
1. src/routes/notes/+page.svelte — Note list page
2. src/routes/notes/[id]/+page.svelte — Note editor page
3. src/lib/components/notes/NoteCard.svelte — Card for list view
4. src/lib/components/notes/NoteEditor.svelte — Markdown editor with toolbar
5. src/lib/components/notes/MarkdownPreview.svelte — Rendered markdown
6. src/lib/components/notes/TemplateSelector.svelte — Template picker
7. src/lib/components/notes/TagInput.svelte — Tag input with auto-suggest
8. src/lib/components/notes/NoteToolbar.svelte — Bold, italic, code, list buttons

Requirements:
- 8 built-in templates from data-model.md
- Template content inserted into editor on selection
- Auto-save every 3 seconds (local only, debounced)
- Explicit "Save" button commits to store
- Markdown toolbar: Bold, Italic, Code inline, Code block, Link, Bullet list, Numbered list
- Preview tab toggle (Write / Preview)
- Code blocks styled with slate-950 bg, primary-300 text, monospace font
- Tags: comma-separated input, auto-suggest existing tags
- Link notes to target (required) and session (optional)
- Filter by: target, template, tag
- Full-text search
- Empty state
- Follow design-system.md markdown preview styling exactly
```

### Prompt 7: Stats Dashboard
```
Build the Stats Dashboard for HuntFlow.

Read:
- mvp.md (Feature 4: Stats Dashboard)
- design-system.md (Stat cards, streak calendar, chart colors)
- data-model.md (UserStats, DailyStat interfaces)

Generate:
1. src/routes/stats/+page.svelte — Full stats page
2. src/routes/+page.svelte — Dashboard home (today's summary + quick actions)
3. src/lib/components/stats/StreakCalendar.svelte — GitHub-style weekly calendar
4. src/lib/components/stats/StatCard.svelte — Individual stat display
5. src/lib/components/stats/TodaySummary.svelte — Today's hunting summary
6. src/lib/components/stats/VulnTypeChart.svelte — Pie/bar chart (Chart.js)
7. src/lib/components/stats/ActivityChart.svelte — Weekly activity bar chart
8. src/lib/components/stats/InsightCard.svelte — Heuristic insights

Requirements:
- Dashboard (home page) shows: today's time, sessions, streak, best streak, quick "Start Session" button
- Stats page shows full breakdown
- Streak calendar: 7-day rows, color intensity by minutes (5 levels)
- Tap day to see sessions from that day
- Stat cards: icon, value, label, trend arrow
- Chart.js for vuln type distribution and activity (tree-shake import)
- Insights with simple heuristics:
  - "X days in a row! 🔥" (streak > 2)
  - "No hunting in 2 days — streak at risk!" (streak about to break)
  - "You've spent X hours on XSS" (most common template)
- All stats computed from sessionStore (no separate storage)
- Follow design-system.md color levels for calendar
```

### Prompt 8: Settings & PWA
```
Build Settings and PWA install flow for HuntFlow.

Read:
- mvp.md (Feature 5: Offline-First, Feature 6: PWA, Feature 7: Settings)
- design-system.md (Form inputs, toggles, select dropdowns)
- data-model.md (Settings interface, DEFAULT_SETTINGS)
- tech-spec.md (Service worker, PWA config)

Generate:
1. src/routes/settings/+page.svelte — Settings page with sections
2. src/lib/components/settings/TimerSettings.svelte — Duration, break, sound, vibration
3. src/lib/components/settings/AppearanceSettings.svelte — Theme, accent color, font size
4. src/lib/components/settings/DataSettings.svelte — Export, import, clear data
5. src/lib/components/settings/AboutSection.svelte — Version, changelog, feedback
6. src/lib/components/ui/Toggle.svelte — Custom toggle switch
7. src/lib/components/ui/ColorPicker.svelte — Accent color selection
8. src/lib/components/pwa/InstallPrompt.svelte — "Add to Home Screen" banner
9. src/lib/components/pwa/OfflineBanner.svelte — "Offline Mode" indicator

Requirements:
- Settings persist to IndexedDB immediately
- Theme toggle: light/dark/system with instant preview
- Accent color: green/blue/orange/purple
- Font size: small/medium/large
- Export: JSON download with all data
- Import: file upload, validate schema, merge or replace
- Clear data: confirmation modal with type-confirm
- Install prompt: shows on 2nd visit, dismissible, remembers choice
- Offline banner: shows when navigator.onLine is false
- Storage usage indicator
- Follow design-system.md form styling exactly
```

---

## 🧩 Component Prompts

### Prompt 9: UI Primitive Components
```
Build the UI primitive component library for HuntFlow.

Read:
- design-system.md (Button, Input, Card, Badge, Modal specs)
- tech-spec.md (Component architecture)

Generate:
1. src/lib/components/ui/Button.svelte — All variants (primary, secondary, danger, icon, ghost)
2. src/lib/components/ui/Input.svelte — Text input with label, error, icon
3. src/lib/components/ui/Textarea.svelte — Textarea with auto-resize
4. src/lib/components/ui/Card.svelte — Standard and interactive variants
5. src/lib/components/ui/Badge.svelte — All color variants
6. src/lib/components/ui/Modal.svelte — Dialog with overlay, close on escape/overlay
7. src/lib/components/ui/Toast.svelte — Notification with auto-dismiss
8. src/lib/components/ui/EmptyState.svelte — Icon + title + description + CTA
9. src/lib/components/ui/LoadingSpinner.svelte — Animated spinner
10. src/lib/components/ui/Skeleton.svelte — Pulse animation placeholder

Requirements:
- All components typed with exported Props interfaces
- All interactive elements minimum 44x44px
- All colors from design-system.md (no arbitrary values)
- Dark mode support via Tailwind dark: prefix
- Disabled states for all interactive components
- Focus visible states for accessibility
- Toast: bottom-right desktop, top-center mobile, 4s auto-dismiss
- Modal: fade + scale animation, close on Escape and overlay click
- Export all from src/lib/components/ui/index.ts
```

### Prompt 10: Navigation & Layout
```
Build the app layout and navigation for HuntFlow.

Read:
- design-system.md (Bottom nav, side nav, layout spacing)
- tech-spec.md (Routing conventions)
- mvp.md (all features)

Generate:
1. src/routes/+layout.svelte — Root layout with:
   - Theme provider (dark default, class on html)
   - Bottom tab bar (mobile)
   - Side navigation (desktop, collapsible)
   - Main content area
   - Toast container
   - Offline banner
2. src/lib/components/layout/BottomNav.svelte — 5 tabs with icons
3. src/lib/components/layout/SideNav.svelte — Desktop sidebar
4. src/lib/components/layout/NavItem.svelte — Individual nav item
5. src/lib/components/layout/MobileHeader.svelte — Top bar with title + actions
6. src/lib/components/layout/PageTransition.svelte — Simple fade transition

Requirements:
- Bottom nav: Dashboard, Timer, Targets, Notes, Settings
- Active state: primary-400 color, subtle bg
- Inactive: slate-500
- Side nav: same items, expanded shows labels, collapsed shows icons only
- Current route highlighted
- Safe area insets for iOS notch
- Status bar color matches theme (meta theme-color)
- Follow design-system.md nav specs exactly
```

---

## 🔧 Utility Prompts

### Prompt 11: Utility Functions
```
Build utility functions for HuntFlow.

Read:
- data-model.md (interfaces)
- tech-spec.md (validation, time formatting)

Generate:
1. src/lib/utils/id.ts — crypto.randomUUID() wrapper with fallback
2. src/lib/utils/time.ts — 
   - formatDuration(seconds) → "25:00" or "1:25:00"
   - formatDate(timestamp) → "Apr 24, 2026"
   - formatRelativeDate(timestamp) → "2 hours ago"
   - getStartOfDay(timestamp) → midnight timestamp
   - getDayOfWeek(timestamp) → 0-6
3. src/lib/utils/stats.ts —
   - computeStreak(sessions) → number
   - computeBestStreak(sessions) → number
   - computeDailyStats(sessions, days) → DailyStat[]
   - computeByVulnType(sessions) → Record<string, number>
   - computeByHour(sessions) → Record<number, number>
4. src/lib/utils/validation.ts — All validation functions from data-model.md
5. src/lib/utils/export.ts — 
   - exportToJSON() → downloads file
   - importFromJSON(file) → validates and merges
6. src/lib/utils/storage.ts — 
   - localStorage wrapper with JSON parse/stringify
   - memory fallback if storage unavailable

Requirements:
- All functions pure (no side effects except export download)
- Full test coverage for stats computation
- Streak algorithm: consecutive days with >=1 completed session
- Export filename: huntflow-export-YYYY-MM-DD.json
```

---

## 🧪 Testing Prompts

### Prompt 12: Manual Testing Script
```
Generate a comprehensive manual testing checklist for HuntFlow MVP.

Read:
- mvp.md (all features, acceptance criteria, definition of done)
- tech-spec.md (performance budgets, browser support)

Output a markdown file: TESTING.md with:

1. Pre-flight checks (build, lint, type check)
2. Timer tests (all states, backgrounding, drift, sound)
3. Target tests (CRUD, filtering, search, status pipeline)
4. Note tests (templates, editor, auto-save, markdown preview)
5. Stats tests (streak calculation, charts, insights)
6. Settings tests (theme, export/import, clear data)
7. PWA tests (install, offline, service worker)
8. Performance tests (Lighthouse, bundle size, memory)
9. Accessibility tests (keyboard, screen reader, contrast)
10. Cross-browser tests (Chrome, Firefox, Safari, mobile)

Each test should have:
- Steps to reproduce
- Expected result
- Pass/Fail checkbox
```

---

## 🚀 Polish Prompts

### Prompt 13: Landing Page
```
Build a simple landing page for HuntFlow.

Read:
- project.md (tagline, features, target audience)
- design-system.md (colors, typography, components)

Generate:
1. src/routes/landing/+page.svelte — Marketing landing page
2. Static sections:
   - Hero: "Hunt smarter. Stay consistent. Get paid." + CTA
   - Features: 3 key features with icons
   - How it works: 3-step process
   - Pricing: Free vs Pro comparison
   - Footer: Links, social, copyright

Requirements:
- Same design system as app
- Dark theme
- Mobile responsive
- No backend needed (static)
- CTA: "Install App" (triggers PWA install)
- Lightweight (<100KB total)
```

### Prompt 14: Onboarding Flow
```
Build an onboarding flow for first-time users.

Read:
- mvp.md (features)
- design-system.md (modal, buttons, typography)

Generate:
1. src/lib/components/onboarding/OnboardingModal.svelte — Multi-step modal
2. Steps:
   - Welcome: "Welcome to HuntFlow" + tagline
   - Timer: "Start focused hunting sessions"
   - Targets: "Track your bug bounty programs"
   - Notes: "Take structured security notes"
   - Stats: "Build consistency with streaks"
   - Done: "Start your first session" CTA

Requirements:
- 6 steps, swipeable or clickable dots
- Skip option always available
- Sets onboardingCompleted = true in settings
- Shows only once (checked on app load)
- Follows design-system.md modal specs
```

---

## 💡 Advanced Prompts (Post-MVP)

### Prompt 15: Report Builder (Pro Feature)
```
Build the Report Builder for HuntFlow Pro.

Read:
- brain.md (Report Builder Architecture section)
- data-model.md (Note interface, ReportTemplate)

Generate:
1. src/lib/components/reports/ReportBuilder.svelte — Report generation UI
2. src/lib/components/reports/ReportPreview.svelte — Live markdown preview
3. src/lib/utils/reports.ts — Template engine

Requirements:
- Select platform: HackerOne, Bugcrowd, Intigriti, Custom
- Auto-populate from note fields
- Severity auto-suggestion from tags
- Markdown export (.md)
- PDF export (server-side in future, client-side for now)
```

### Prompt 16: Income Tracker (Pro Feature)
```
Build the Income Tracker for HuntFlow Pro.

Read:
- project.md (Pro features)
- data-model.md (interfaces)

Generate:
1. src/routes/income/+page.svelte — Income tracking page
2. src/lib/components/income/PayoutForm.svelte — Add/edit payout
3. src/lib/components/income/IncomeChart.svelte — Earnings over time
4. src/lib/components/income/TaxExport.svelte — CSV export

Requirements:
- Log payouts: program, platform, severity, amount, date, status
- Status: Pending → Triaged → Paid
- Charts: by platform, by severity, over time
- Tax export: CSV with date, program, amount, platform
```

---

## 🎨 Prompt Engineering Tips

### For Best Results:
1. **Always attach the relevant MD files** as context before pasting the prompt
2. **Be specific about file paths** — tell the AI exactly where to put the code
3. **Reference acceptance criteria** — copy the checklist from mvp.md into the prompt
4. **Ask for one feature at a time** — don't try to build everything in one prompt
5. **Review against design-system.md** — check colors, spacing, and component specs
6. **Test immediately** — run the app after each prompt, don't batch too much

### If the AI Goes Off-Track:
```
"Stop. Re-read design-system.md. The colors should be slate-800 for cards, 
not gray-800. The primary color is green (primary-500 = #22c55e), not blue. 
Fix the component and follow the design system exactly."
```

### If the AI Forgets Constraints:
```
"Re-read tech-spec.md section 'Performance Rules'. This component must not 
exceed the bundle budget. Remove the heavy dependency and use the lightweight 
alternative specified in the tech spec."
```

### If the AI Generates Wrong Types:
```
"Re-read data-model.md. The Session interface requires 'startedAt' to be a 
number (Unix timestamp), not a Date object. Fix the type and all usages."
```

---

## 📋 Copy-Paste Quick Reference

| I want to build... | Use Prompt... | Attach these MDs |
|-------------------|---------------|-----------------|
| Project setup | #1 | project, tech-spec, design-system |
| Database layer | #2 | data-model, tech-spec |
| State management | #3 | data-model, tech-spec, mvp |
| Timer feature | #4 | mvp, design-system, data-model, tech-spec |
| Target tracker | #5 | mvp, design-system, data-model |
| Notes system | #6 | mvp, design-system, data-model |
| Stats dashboard | #7 | mvp, design-system, data-model |
| Settings & PWA | #8 | mvp, design-system, data-model, tech-spec |
| UI components | #9 | design-system, tech-spec |
| Navigation | #10 | design-system, tech-spec, mvp |
| Utilities | #11 | data-model, tech-spec |
| Testing checklist | #12 | mvp, tech-spec |
| Landing page | #13 | project, design-system |
| Onboarding | #14 | mvp, design-system |
| Report builder | #15 | brain, data-model |
| Income tracker | #16 | project, data-model |

---

*These prompts are optimized for Cursor, Claude Code, GitHub Copilot Chat, and similar AI coding assistants. Adjust verbosity based on your tool's context window.*

*Last updated: 2026-04-24*
