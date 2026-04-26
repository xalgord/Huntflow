# data-model.md — HuntFlow TypeScript Schema & Data Shapes

> **Purpose:** The single source of truth for all data structures. Feed this to your AI before it writes any store, DB layer, or component that touches data.

---

## Core Entities

### Session
```typescript
interface Session {
  /** UUID v4, generated client-side */
  id: string;

  /** Reference to target being hunted */
  targetId: string;

  /** Reference to note template used (optional) */
  templateId?: string;

  /** Planned duration in seconds (e.g., 1500 for 25min) */
  durationPlanned: number;

  /** Actual duration in seconds (may be less if abandoned) */
  durationActual: number;

  /** Unix timestamp (ms) when session started */
  startedAt: number;

  /** Unix timestamp (ms) when session ended */
  endedAt?: number;

  /** Current state of the session */
  status: 'running' | 'paused' | 'completed' | 'abandoned';

  /** Quick note entered on session completion */
  quickNote?: string;

  /** Tags for categorization */
  tags: SessionTag[];
}

type SessionTag = 
  | 'critical' 
  | 'high' 
  | 'medium' 
  | 'low' 
  | 'needs-report' 
  | 'duplicate' 
  | 'informative' 
  | 'wont-fix';
```

**Validation Rules:**
- `id`: Must be valid UUID v4
- `targetId`: Must reference existing target
- `durationPlanned`: Must be > 0 and <= 14400 (4 hours max)
- `durationActual`: Must be >= 0 and <= `durationPlanned`
- `startedAt`: Must be <= `Date.now()`
- `endedAt`: If present, must be >= `startedAt`
- `status`: 'abandoned' only if `durationActual < durationPlanned * 0.5`
- `tags`: Max 5 tags per session

---

### Target
```typescript
interface Target {
  /** UUID v4 */
  id: string;

  /** Program/company name */
  name: string;

  /** Bug bounty platform */
  platform: Platform;

  /** URL to program page (optional) */
  programUrl?: string;

  /** In-scope domains/URLs, one per line */
  scope: string;

  /** General notes about the program */
  notes: string;

  /** Priority level */
  priority: Priority;

  /** Current hunting status */
  status: TargetStatus;

  /** When target was created */
  createdAt: number;

  /** When target was last modified */
  updatedAt: number;

  /** Timestamp of most recent session */
  lastSessionAt?: number;

  /** Number of completed sessions */
  sessionCount: number;
}

type Platform = 
  | 'hackerone' 
  | 'bugcrowd' 
  | 'intigriti' 
  | 'synack' 
  | 'yeswehack' 
  | 'self-hosted' 
  | 'other';

type Priority = 0 | 1 | 2 | 3;

type TargetStatus = 
  | 'recon' 
  | 'testing' 
  | 'reported' 
  | 'paid' 
  | 'closed' 
  | 'archived';
```

**Validation Rules:**
- `id`: Valid UUID v4
- `name`: 1-100 characters, required
- `platform`: Must be one of defined values
- `programUrl`: If present, must be valid URL
- `scope`: Max 5000 characters
- `notes`: Max 10000 characters
- `priority`: 0=P0 (critical), 1=P1 (high), 2=P2 (medium), 3=P3 (low)
- `status`: Default 'recon' on creation
- `createdAt`/`updatedAt`: Unix timestamps

---

### Payout
```typescript
interface Payout {
  /** UUID v4 */
  id: string;

  /** Program/company name */
  program: string;

  /** Bug bounty platform */
  platform: Platform;

  /** Report severity */
  severity: PayoutSeverity;

  /** Payout amount in USD */
  amount: number;

  /** Payout/report date as Unix timestamp (ms) */
  date: number;

  /** Current payout state */
  status: PayoutStatus;

  /** When payout was created */
  createdAt: number;

  /** When payout was last modified */
  updatedAt: number;
}

type PayoutSeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

type PayoutStatus = 'pending' | 'triaged' | 'paid';
```

**Validation Rules:**
- `id`: Valid UUID v4
- `program`: 1-100 characters, required
- `platform`: Must be one of defined platform values
- `severity`: Must be one of defined payout severities
- `amount`: Must be > 0
- `date`: Unix timestamp
- `status`: `pending` → `triaged` → `paid`
- `createdAt`/`updatedAt`: Unix timestamps

---

### Note
```typescript
interface Note {
  /** UUID v4 */
  id: string;

  /** Note title */
  title: string;

  /** Markdown content */
  content: string;

  /** Reference to target this note belongs to */
  targetId: string;

  /** Reference to session during which note was taken (optional) */
  sessionId?: string;

  /** Reference to template used (optional) */
  templateId?: string;

  /** User-defined tags */
  tags: string[];

  /** When note was created */
  createdAt: number;

  /** When note was last modified */
  updatedAt: number;
}
```

**Validation Rules:**
- `id`: Valid UUID v4
- `title`: 1-200 characters, required
- `content`: Max 50000 characters
- `targetId`: Must reference existing target
- `sessionId`: If present, must reference existing session
- `tags`: Max 10 tags, each max 30 characters, alphanumeric + hyphen/underscore only

---

### NoteTemplate
```typescript
interface NoteTemplate {
  /** Unique template identifier */
  id: string;

  /** Display name */
  name: string;

  /** Category for grouping */
  category: TemplateCategory;

  /** Template body with markdown + {{placeholders}} */
  content: string;

  /** Whether this is a built-in template */
  isBuiltIn: boolean;

  /** Whether this is user-created (Pro feature) */
  isCustom?: boolean;
}

type TemplateCategory = 
  | 'web' 
  | 'mobile' 
  | 'api' 
  | 'cloud' 
  | 'network' 
  | 'general';
```

**Built-in Templates (8):**
```typescript
const BUILT_IN_TEMPLATES: NoteTemplate[] = [
  {
    id: 'subdomain-takeover',
    name: 'Subdomain Takeover',
    category: 'web',
    content: `## Subdomain Takeover

### Vulnerable Subdomain

### Affected Service
(e.g., Heroku, AWS S3, GitHub Pages, Azure, etc.)

### Proof of Takeover

### Impact

### Remediation`,
    isBuiltIn: true
  },
  {
    id: 'idor',
    name: 'IDOR',
    category: 'web',
    content: `## Insecure Direct Object Reference (IDOR)

### Vulnerable Endpoint

### Parameter

### Normal Request (Authorized)

### Modified Request (Unauthorized)

### Response Difference

### Impact

### Remediation`,
    isBuiltIn: true
  },
  {
    id: 'ssrf',
    name: 'SSRF',
    category: 'web',
    content: `## Server-Side Request Forgery (SSRF)

### Vulnerable Endpoint

### Payload Used

### Internal Service Accessed

### Data Exfiltrated

### Impact

### Remediation`,
    isBuiltIn: true
  },
  {
    id: 'sql-injection',
    name: 'SQL Injection',
    category: 'web',
    content: `## SQL Injection

### Vulnerable Endpoint

### Parameter

### Payload

### Database Type (if identified)

### Proof
(error message / time delay / data extraction)

### Impact

### Remediation`,
    isBuiltIn: true
  },
  {
    id: 'xss',
    name: 'XSS',
    category: 'web',
    content: `## Cross-Site Scripting (XSS)

### Vulnerable Endpoint

### Parameter/Location

### Payload

### Context
(reflected / stored / DOM)

### WAF Bypass (if any)

### Impact

### Remediation`,
    isBuiltIn: true
  },
  {
    id: 'auth-bypass',
    name: 'Authentication Bypass',
    category: 'web',
    content: `## Authentication Bypass

### Vulnerable Endpoint

### Bypass Technique

### Normal Flow

### Bypassed Flow

### Impact

### Remediation`,
    isBuiltIn: true
  },
  {
    id: 'info-disclosure',
    name: 'Information Disclosure',
    category: 'web',
    content: `## Information Disclosure

### Source Endpoint

### Sensitive Data Exposed

### Exposure Method
(error message / API / file / etc.)

### Impact

### Remediation`,
    isBuiltIn: true
  },
  {
    id: 'business-logic',
    name: 'Business Logic Flaw',
    category: 'web',
    content: `## Business Logic Flaw

### Affected Feature

### Intended Behavior

### Actual Behavior

### Attack Scenario

### Financial Impact (if any)

### Remediation`,
    isBuiltIn: true
  }
];
```

---

### Settings
```typescript
interface AppSettings {
  /** Unique key for this setting */
  key: string;

  /** Setting value (serialized) */
  value: unknown;
}

// Typed settings interface
interface Settings {
  /** Default session duration in seconds */
  defaultDuration: number;

  /** Whether to auto-start break timer */
  autoStartBreak: boolean;

  /** Break duration in seconds */
  breakDuration: number;

  /** Sessions before long break */
  sessionsBeforeLongBreak: number;

  /** Long break duration in seconds */
  longBreakDuration: number;

  /** Sound notifications enabled */
  soundEnabled: boolean;

  /** Vibration on mobile */
  vibrationEnabled: boolean;

  /** Theme preference */
  theme: 'light' | 'dark' | 'system';

  /** Accent color */
  accentColor: 'green' | 'blue' | 'orange' | 'purple';

  /** Font size */
  fontSize: 'small' | 'medium' | 'large';

  /** Whether user has seen onboarding */
  onboardingCompleted: boolean;

  /** Last export timestamp */
  lastExportAt?: number;
}

const DEFAULT_SETTINGS: Settings = {
  defaultDuration: 1500,        // 25 minutes
  autoStartBreak: true,
  breakDuration: 300,           // 5 minutes
  sessionsBeforeLongBreak: 4,
  longBreakDuration: 900,       // 15 minutes
  soundEnabled: true,
  vibrationEnabled: true,
  theme: 'dark',
  accentColor: 'green',
  fontSize: 'medium',
  onboardingCompleted: false
};
```

---

## Derived/Computed Types

### Stats
```typescript
interface UserStats {
  /** Total hunting time in seconds (all completed sessions) */
  totalTimeSeconds: number;

  /** Total number of sessions */
  totalSessions: number;

  /** Number of completed sessions */
  completedSessions: number;

  /** Number of abandoned sessions */
  abandonedSessions: number;

  /** Average session length in seconds */
  avgSessionLength: number;

  /** Current streak (consecutive days with >=1 completed session) */
  streak: number;

  /** Best streak ever */
  bestStreak: number;

  /** Sessions grouped by vulnerability type */
  byVulnType: Record<string, number>;

  /** Sessions grouped by target */
  byTarget: Record<string, { count: number; time: number }>;

  /** Sessions grouped by hour of day (0-23) */
  byHour: Record<number, number>;

  /** Daily stats for the last 30 days */
  dailyStats: DailyStat[];
}

interface DailyStat {
  /** Date in YYYY-MM-DD format */
  date: string;

  /** Total hunting minutes that day */
  totalMinutes: number;

  /** Number of sessions */
  sessionCount: number;

  /** Number of completed sessions */
  completedCount: number;
}
```

### Timer State
```typescript
interface TimerState {
  /** Current timer status */
  status: 'idle' | 'running' | 'paused' | 'completed';

  /** Remaining time in milliseconds */
  remainingMs: number;

  /** Total duration in milliseconds */
  totalMs: number;

  /** Current session ID (if running) */
  sessionId?: string;

  /** When the timer will end (timestamp) */
  endTime?: number;

  /** Progress percentage (0-100) */
  progress: number;
}
```

---

## Relationships

```
Target 1 ────* Session
  │            │
  │            │
  └──────* Note
         │
         │ (optional)
         └──────1 Session

NoteTemplate * ────* Note (via templateId)
```

### Cascade Rules
- **Delete Target:** Cascade delete all related Sessions and Notes (with confirmation)
- **Delete Session:** Set `sessionId` to null on related Notes (keep notes)
- **Delete Note:** No cascade (standalone entity)

---

## IndexedDB Schema

```typescript
const DB_NAME = 'huntflow';
const DB_VERSION = 1;

interface HuntFlowDB extends DBSchema {
  sessions: {
    key: string;
    value: Session;
    indexes: {
      'by-target': string;
      'by-started': number;
      'by-status': string;
    };
  };
  notes: {
    key: string;
    value: Note;
    indexes: {
      'by-target': string;
      'by-session': string;
      'by-template': string;
      'by-tags': string;
      'by-updated': number;
    };
  };
  targets: {
    key: string;
    value: Target;
    indexes: {
      'by-platform': string;
      'by-status': string;
      'by-priority': number;
      'by-updated': number;
    };
  };
  payouts: {
    key: string;
    value: Payout;
    indexes: {
      'by-platform': string;
      'by-severity': string;
      'by-status': string;
      'by-date': number;
      'by-updated': number;
    };
  };
  templates: {
    key: string;
    value: NoteTemplate;
    indexes: {
      'by-category': string;
    };
  };
  settings: {
    key: string;
    value: AppSettings;
  };
}
```

---

## Export/Import Format

### Export Schema (JSON)
```typescript
interface HuntFlowExport {
  /** Export metadata */
  meta: {
    version: string;        // "1.0"
    exportedAt: number;     // timestamp
    appVersion: string;
  };

  /** All user data */
  data: {
    sessions: Session[];
    notes: Note[];
    targets: Target[];
    payouts: Payout[];
    settings: Settings;
  };
}
```

### Example Export
```json
{
  "meta": {
    "version": "1.0",
    "exportedAt": 1713984000000,
    "appVersion": "1.0.0"
  },
  "data": {
    "sessions": [...],
    "notes": [...],
    "targets": [...],
    "payouts": [...],
    "settings": {
      "defaultDuration": 1500,
      "theme": "dark",
      ...
    }
  }
}
```

---

## Validation Utilities

```typescript
// utils/validation.ts

export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidTag(tag: string): boolean {
  return /^[a-z0-9_-]{1,30}$/i.test(tag);
}

export function validateSession(session: Partial<Session>): string[] {
  const errors: string[] = [];

  if (!session.id || !isValidUUID(session.id)) {
    errors.push('Invalid session ID');
  }
  if (!session.targetId || !isValidUUID(session.targetId)) {
    errors.push('Invalid target ID');
  }
  if (!session.durationPlanned || session.durationPlanned <= 0 || session.durationPlanned > 14400) {
    errors.push('Duration must be between 1 and 14400 seconds');
  }
  if (session.durationActual !== undefined && session.durationActual < 0) {
    errors.push('Actual duration cannot be negative');
  }
  if (session.startedAt && session.startedAt > Date.now()) {
    errors.push('Start time cannot be in the future');
  }

  return errors;
}

export function validateTarget(target: Partial<Target>): string[] {
  const errors: string[] = [];

  if (!target.id || !isValidUUID(target.id)) {
    errors.push('Invalid target ID');
  }
  if (!target.name || target.name.trim().length === 0) {
    errors.push('Target name is required');
  }
  if (target.name && target.name.length > 100) {
    errors.push('Target name must be <= 100 characters');
  }
  if (target.programUrl && !isValidURL(target.programUrl)) {
    errors.push('Invalid program URL');
  }
  if (target.scope && target.scope.length > 5000) {
    errors.push('Scope must be <= 5000 characters');
  }
  if (target.notes && target.notes.length > 10000) {
    errors.push('Notes must be <= 10000 characters');
  }

  return errors;
}

export function validateNote(note: Partial<Note>): string[] {
  const errors: string[] = [];

  if (!note.id || !isValidUUID(note.id)) {
    errors.push('Invalid note ID');
  }
  if (!note.title || note.title.trim().length === 0) {
    errors.push('Note title is required');
  }
  if (note.title && note.title.length > 200) {
    errors.push('Title must be <= 200 characters');
  }
  if (note.content && note.content.length > 50000) {
    errors.push('Content must be <= 50000 characters');
  }
  if (!note.targetId || !isValidUUID(note.targetId)) {
    errors.push('Invalid target ID');
  }
  if (note.tags) {
    if (note.tags.length > 10) {
      errors.push('Max 10 tags allowed');
    }
    for (const tag of note.tags) {
      if (!isValidTag(tag)) {
        errors.push(`Invalid tag: "${tag}"`);
      }
    }
  }

  return errors;
}
```

---

*This file prevents type drift. When your AI generates a store, component, or DB method, it should reference these exact interfaces.*

*Last updated: 2026-04-24*
