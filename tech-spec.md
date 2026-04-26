# tech-spec.md — HuntFlow Technical Specification

> **Purpose:** The build guide. Feed this to your AI coding assistant before asking it to generate any code. It defines *how* things are built, not *what* is built.

---

## Project Structure

```
huntflow/
├── src/
│   ├── lib/
│   │   ├── db/                    # IndexedDB layer
│   │   │   ├── index.ts           # DB init, connection
│   │   │   ├── sessions.ts        # Session CRUD
│   │   │   ├── notes.ts           # Note CRUD
│   │   │   ├── targets.ts         # Target CRUD
│   │   │   ├── templates.ts       # Built-in templates
│   │   │   └── schema.ts          # TypeScript interfaces
│   │   ├── stores/                # Svelte stores
│   │   │   ├── sessionStore.ts
│   │   │   ├── noteStore.ts
│   │   │   ├── targetStore.ts
│   │   │   ├── statsStore.ts      # Computed stats from sessions
│   │   │   └── settingsStore.ts
│   │   ├── components/            # Reusable components
│   │   │   ├── ui/                # Primitive UI (Button, Input, Card)
│   │   │   ├── timer/             # Timer-specific
│   │   │   ├── notes/             # Note editor, list
│   │   │   ├── targets/           # Target cards, forms
│   │   │   └── stats/             # Charts, calendar
│   │   ├── utils/                 # Helpers
│   │   │   ├── id.ts              # UUID generation
│   │   │   ├── time.ts            # Date formatting, duration math
│   │   │   ├── stats.ts           # Stats computation
│   │   │   └── export.ts          # JSON export/import
│   │   └── types/                 # Shared types
│   │       └── index.ts
│   ├── routes/                    # SvelteKit routes
│   │   ├── +layout.svelte         # Root layout (nav, theme)
│   │   ├── +page.svelte           # Dashboard (home)
│   │   ├── timer/
│   │   │   └── +page.svelte       # Focus timer page
│   │   ├── targets/
│   │   │   ├── +page.svelte       # Target list
│   │   │   └── [id]/
│   │   │       └── +page.svelte   # Target detail
│   │   ├── notes/
│   │   │   ├── +page.svelte       # Note list
│   │   │   └── [id]/
│   │   │       └── +page.svelte   # Note editor
│   │   ├── stats/
│   │   │   └── +page.svelte       # Full stats page
│   │   └── settings/
│   │       └── +page.svelte       # Settings page
│   ├── app.html                   # HTML template
│   ├── app.css                    # Global styles
│   └── service-worker.ts          # PWA service worker
├── static/
│   ├── manifest.json              # PWA manifest
│   ├── icons/                     # App icons
│   └── favicon.png
├── tests/                         # Playwright tests
├── vite.config.ts
├── svelte.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## State Management Rules

### 1. Svelte Stores Are the Source of Truth
All app state lives in Svelte stores. Components never hold local state for data that needs to persist.

```typescript
// ❌ BAD: Component holds state
let sessions = [];

// ✅ GOOD: Subscribe to store
import { sessionStore } from '$lib/stores/sessionStore';
$: sessions = $sessionStore;
```

### 2. Store → IndexedDB Pipeline
Every store write triggers an IndexedDB write. This is automatic via store subscriptions.

```typescript
// sessionStore.ts
import { writable } from 'svelte/store';
import { db } from '$lib/db';

function createSessionStore() {
  const { subscribe, set, update } = writable<Session[]>([]);

  // Load from IndexedDB on init
  db.sessions.getAll().then(sessions => set(sessions));

  // Auto-save to IndexedDB on every change
  subscribe(sessions => {
    // Debounced batch write
    db.sessions.putBatch(sessions);
  });

  return { subscribe, set, update };
}
```

### 3. Computed Stores Derive from Source Stores
Stats are computed, not stored.

```typescript
// statsStore.ts
import { derived } from 'svelte/store';
import { sessionStore } from './sessionStore';

export const streakStore = derived(sessionStore, $sessions => {
  return computeStreak($sessions);
});

export const todayMinutesStore = derived(sessionStore, $sessions => {
  const today = new Date().toISOString().split('T')[0];
  return $sessions
    .filter(s => s.startedAt.startsWith(today) && s.status === 'completed')
    .reduce((sum, s) => sum + s.durationActual, 0);
});
```

---

## IndexedDB Access Pattern

### Wrapper Class Pattern
Every entity gets a wrapper class with typed methods.

```typescript
// db/sessions.ts
import { openDB } from 'idb';
import type { Session } from './schema';

const DB_NAME = 'huntflow';
const DB_VERSION = 1;

class SessionDB {
  private db: IDBPDatabase | null = null;

  async init() {
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sessions')) {
          const store = db.createObjectStore('sessions', { keyPath: 'id' });
          store.createIndex('targetId', 'targetId', { unique: false });
          store.createIndex('startedAt', 'startedAt', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
      }
    });
  }

  async getAll(): Promise<Session[]> {
    if (!this.db) await this.init();
    return this.db!.getAll('sessions');
  }

  async getById(id: string): Promise<Session | undefined> {
    if (!this.db) await this.init();
    return this.db!.get('sessions', id);
  }

  async put(session: Session): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('sessions', session);
  }

  async delete(id: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete('sessions', id);
  }

  async getByTarget(targetId: string): Promise<Session[]> {
    if (!this.db) await this.init();
    return this.db!.getAllFromIndex('sessions', 'targetId', targetId);
  }
}

export const sessionDB = new SessionDB();
```

### CRUD Naming Convention
| Operation | Method Name | Returns |
|-----------|-------------|---------|
| Create/Update | `put(entity)` | `Promise<void>` |
| Read One | `getById(id)` | `Promise<Entity \| undefined>` |
| Read All | `getAll()` | `Promise<Entity[]>` |
| Read By Index | `getBy{IndexName}(value)` | `Promise<Entity[]>` |
| Delete | `delete(id)` | `Promise<void>` |

---

## Component Architecture

### Atomic Design (Simplified)
We use 3 levels, not 5:

1. **Primitives** (`ui/`): Button, Input, Textarea, Badge, Card, Icon
2. **Composites** (`timer/`, `notes/`, `targets/`, `stats/`): TimerRing, NoteCard, TargetForm, StreakCalendar
3. **Pages** (`routes/`): Full screens composed of composites

### Component File Template
```svelte
<!-- Every component follows this structure -->
<script lang="ts">
  // 1. Imports (types first, then stores, then utils)
  import type { Session } from '$lib/types';
  import { sessionStore } from '$lib/stores/sessionStore';
  import { formatDuration } from '$lib/utils/time';

  // 2. Props (typed, with defaults)
  export let session: Session;
  export let compact: boolean = false;

  // 3. Reactive statements
  $: duration = formatDuration(session.durationActual);
  $: isCompleted = session.status === 'completed';

  // 4. Event handlers
  function handleDelete() {
    sessionStore.delete(session.id);
  }
</script>

<!-- 5. Template -->
<div class="card {compact ? 'compact' : ''}">
  <!-- content -->
</div>

<!-- 6. Scoped styles (Tailwind only, minimal custom CSS) -->
<style>
  .card {
    @apply bg-slate-800 rounded-lg p-4;
  }
  .compact {
    @apply p-2 text-sm;
  }
</style>
```

### Props Interface Pattern
```typescript
// Always export props interface
export interface SessionCardProps {
  session: Session;
  compact?: boolean;
  showActions?: boolean;
  onDelete?: (id: string) => void;
}
```

---

## Routing Conventions

| Route | Purpose | Data Loading |
|-------|---------|-------------|
| `/` | Dashboard | Load stats from sessionStore |
| `/timer` | Focus timer | No data load (creates new) |
| `/timer?target=xyz` | Timer with pre-selected target | Load target by ID |
| `/targets` | Target list | Load all targets |
| `/targets/[id]` | Target detail | Load target + sessions by target |
| `/notes` | Note list | Load all notes |
| `/notes/[id]` | Note editor | Load note by ID |
| `/stats` | Full stats | Load computed stats |
| `/settings` | Settings | Load settings store |

### Page Load Pattern
```typescript
// +page.ts (load function)
import { targetDB } from '$lib/db/targets';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
  const target = await targetDB.getById(params.id);
  if (!target) throw error(404, 'Target not found');

  const sessions = await sessionDB.getByTarget(params.id);

  return { target, sessions };
}
```

---

## Timer Implementation Details

### The Timer Must Not Drift
Use `Date.now()` timestamps, NOT `setInterval` counting.

```typescript
// Correct timer implementation
class TimerEngine {
  private endTime: number = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private remainingCallback: ((ms: number) => void) | null = null;

  start(durationMs: number) {
    this.endTime = Date.now() + durationMs;
    this.intervalId = setInterval(() => {
      const remaining = this.endTime - Date.now();
      if (remaining <= 0) {
        this.stop();
        this.onComplete?.();
      } else {
        this.remainingCallback?.(remaining);
      }
    }, 1000);
  }

  pause() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // Store remaining time for resume
    this.pausedRemaining = this.endTime - Date.now();
  }

  resume() {
    this.endTime = Date.now() + this.pausedRemaining;
    this.start(this.pausedRemaining);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
```

### Background Timer Strategy
When the app is backgrounded, `setInterval` throttles to 1Hz or pauses. Solution:

1. Store `endTime` in IndexedDB when timer starts
2. On `visibilitychange` → `visible`, recalculate remaining from `endTime - Date.now()`
3. If `remaining <= 0`, trigger completion immediately
4. Service Worker NOT needed for timer (overkill for MVP)

```typescript
// In +page.svelte (timer page)
onMount(() => {
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      // Recalculate from stored endTime
      const storedEnd = localStorage.getItem('timerEndTime');
      if (storedEnd) {
        const remaining = parseInt(storedEnd) - Date.now();
        if (remaining <= 0) {
          completeSession();
        } else {
          updateDisplay(remaining);
        }
      }
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);
  return () => document.removeEventListener('visibilitychange', handleVisibility);
});
```

---

## Form Handling

### No Form Libraries
Use Svelte's built-in form handling. It's lightweight and sufficient.

```svelte
<script>
  let name = '';
  let platform = 'hackerone';
  let errors: Record<string, string> = {};

  function validate() {
    errors = {};
    if (!name.trim()) errors.name = 'Name is required';
    if (name.length > 100) errors.name = 'Name too long';
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    await targetDB.put({ id: crypto.randomUUID(), name, platform, ... });
    goto('/targets');
  }
</script>

<form on:submit|preventDefault={handleSubmit}>
  <input bind:value={name} class:error={errors.name} />
  {#if errors.name}<span class="error">{errors.name}</span>{/if}

  <select bind:value={platform}>
    <option value="hackerone">HackerOne</option>
    <!-- ... -->
  </select>

  <button type="submit">Save</button>
</form>
```

---

## Error Handling

### Global Error Boundary
```svelte
<!-- +layout.svelte -->
<script>
  import { onMount } from 'svelte';

  let error: Error | null = null;

  onMount(() => {
    window.addEventListener('error', (e) => {
      error = e.error;
      // Log to console, maybe send to analytics in future
    });
    window.addEventListener('unhandledrejection', (e) => {
      error = e.reason;
    });
  });
</script>

{#if error}
  <div class="error-boundary">
    <h2>Something went wrong</h2>
    <p>{error.message}</p>
    <button on:click={() => { error = null; location.reload(); }}>
      Reload App
    </button>
  </div>
{:else}
  <slot />
{/if}
```

### IndexedDB Error Fallback
If IndexedDB fails (private browsing, storage full), fall back to in-memory storage with a warning banner.

```typescript
// db/index.ts
let memoryFallback = false;

export async function initDB() {
  try {
    await sessionDB.init();
    await noteDB.init();
    await targetDB.init();
  } catch (e) {
    console.warn('IndexedDB failed, using memory fallback:', e);
    memoryFallback = true;
    // Initialize memory-backed stores
  }
}

export function isMemoryFallback() {
  return memoryFallback;
}
```

---

## Performance Rules

### Bundle Size Budgets
| Chunk | Max Size |
|-------|----------|
| Initial (app + layout) | 80KB |
| Timer page | 30KB |
| Notes page | 25KB |
| Stats page (with Chart.js) | 50KB |
| Settings page | 15KB |

### Lazy Loading
```typescript
// Lazy load heavy components
import { onMount } from 'svelte';

let ChartComponent: any;

onMount(async () => {
  const module = await import('$lib/components/stats/Chart.svelte');
  ChartComponent = module.default;
});
```

### Image Rules
- No external images (all icons from Lucide)
- If images needed: WebP, <50KB, lazy loaded
- No base64 inlined images >1KB

### List Virtualization
If a list exceeds 100 items, virtualize:
```svelte
<!-- Use svelte-virtual-list or similar -->
<VirtualList items={$sessionStore} let:item>
  <SessionCard session={item} />
</VirtualList>
```

---

## CSS Architecture

### Tailwind-First
Use Tailwind utilities for 95% of styling. Custom CSS only for:
- Complex animations (timer ring)
- Scrollbar styling
- Print styles (for report export)

### Theme Configuration
```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
          900: '#14532d',
        },
        slate: {
          850: '#1e293b', // Custom between 800 and 900
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
```

### Dark Mode
Use Tailwind's `dark:` prefix. Dark mode is default (hunters prefer it).

```svelte
<div class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
```

Toggle via class on `<html>`:
```typescript
// settingsStore.ts
function setTheme(theme: 'light' | 'dark' | 'system') {
  const isDark = theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}
```

---

## Service Worker Strategy

### Cache Strategy by Asset Type
| Asset Type | Strategy | Reason |
|-----------|----------|--------|
| App shell (HTML, JS, CSS) | Cache-first | Must work offline |
| Static assets (icons, fonts) | Cache-first | Rarely change |
| API calls (future) | Network-first | Data freshness |
| External resources | No cache | Not needed for MVP |

### Service Worker Template
```typescript
// service-worker.ts
import { build, files, version } from '$service-worker';

const CACHE = `huntflow-${version}`;
const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});
```

---

## Testing Strategy (MVP)

### Manual Testing Checklist
Before each release, verify:
- [ ] Timer works for full 25min without drift
- [ ] Timer survives app backgrounding (mobile)
- [ ] Notes auto-save and survive page refresh
- [ ] Targets can be created, edited, deleted
- [ ] Stats update immediately after session completion
- [ ] Export produces valid JSON
- [ ] Import restores all data
- [ ] App loads offline (airplane mode)
- [ ] App installs on Android
- [ ] Dark mode persists across sessions

### Automated Tests (If Time Permits)
```typescript
// Example: Timer logic unit test
import { describe, it, expect, vi } from 'vitest';
import { TimerEngine } from '$lib/utils/timer';

describe('TimerEngine', () => {
  it('completes after duration', () => {
    const timer = new TimerEngine();
    const onComplete = vi.fn();
    timer.onComplete = onComplete;

    timer.start(100); // 100ms for testing

    return new Promise(resolve => {
      setTimeout(() => {
        expect(onComplete).toHaveBeenCalled();
        resolve();
      }, 150);
    });
  });
});
```

---

## Dependencies (Locked)

### Production
```json
{
  "svelte": "^4.0.0",
  "@sveltejs/kit": "^1.0.0",
  "tailwindcss": "^3.3.0",
  "idb": "^7.1.0",
  "chart.js": "^4.4.0",
  "lucide-svelte": "^0.300.0"
}
```

### Dev
```json
{
  "vite": "^5.0.0",
  "typescript": "^5.0.0",
  "vitest": "^1.0.0",
  "@playwright/test": "^1.40.0"
}
```

### Forbidden (Unless Justified)
- ❌ React, Vue, Angular
- ❌ Redux, Zustand, Pinia (Svelte stores are enough)
- ❌ Form libraries (FormKit, React Hook Form)
- ❌ Animation libraries (Framer Motion, GSAP)
- ❌ UI component libraries (Material UI, Chakra)
- ❌ Moment.js (use native Date or date-fns if needed)
- ❌ Lodash (native methods are sufficient)

---

## Build Commands

```bash
# Development
npm run dev          # Start dev server

# Build
npm run build        # Production build
npm run preview      # Preview production build

# Test
npm run test         # Unit tests (Vitest)
npm run test:e2e     # E2E tests (Playwright)

# Lint
npm run lint         # ESLint
npm run check        # Svelte type check
```

---

*Feed this file to your AI assistant before asking it to write any code. It prevents the AI from making arbitrary architectural decisions.*

*Last updated: 2026-04-24*
