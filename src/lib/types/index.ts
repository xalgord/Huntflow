import type { DBSchema } from 'idb';

export interface Session {
  id: string;
  targetId: string;
  templateId?: string;
  durationPlanned: number;
  durationActual: number;
  startedAt: number;
  endedAt?: number;
  status: 'running' | 'paused' | 'completed' | 'abandoned';
  quickNote?: string;
  tags: SessionTag[];
}

export type SessionTag =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'needs-report'
  | 'duplicate'
  | 'informative'
  | 'wont-fix';

export interface Target {
  id: string;
  name: string;
  platform: Platform;
  programUrl?: string;
  scope: string;
  notes: string;
  priority: Priority;
  status: TargetStatus;
  createdAt: number;
  updatedAt: number;
  lastSessionAt?: number;
  sessionCount: number;
}

export type Platform =
  | 'hackerone'
  | 'bugcrowd'
  | 'intigriti'
  | 'synack'
  | 'yeswehack'
  | 'self-hosted'
  | 'other';

export type Priority = 0 | 1 | 2 | 3;

export type TargetStatus = 'recon' | 'testing' | 'reported' | 'paid' | 'closed' | 'archived';

export type PayoutSeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

export type PayoutStatus = 'pending' | 'triaged' | 'paid';

export interface Payout {
  id: string;
  program: string;
  platform: Platform;
  severity: PayoutSeverity;
  amount: number;
  date: number;
  status: PayoutStatus;
  createdAt: number;
  updatedAt: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  targetId: string;
  sessionId?: string;
  templateId?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface NoteTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  content: string;
  isBuiltIn: boolean;
  isCustom?: boolean;
}

export type TemplateCategory = 'web' | 'mobile' | 'api' | 'cloud' | 'network' | 'general';

export interface AppSettings {
  key: string;
  value: unknown;
}

export interface Settings {
  defaultDuration: number;
  autoStartBreak: boolean;
  breakDuration: number;
  sessionsBeforeLongBreak: number;
  longBreakDuration: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
  accentColor: 'green' | 'blue' | 'orange' | 'purple';
  fontSize: 'small' | 'medium' | 'large';
  onboardingCompleted: boolean;
  lastExportAt?: number;
}

export interface UserStats {
  totalTimeSeconds: number;
  totalSessions: number;
  completedSessions: number;
  abandonedSessions: number;
  avgSessionLength: number;
  streak: number;
  bestStreak: number;
  byVulnType: Record<string, number>;
  byTarget: Record<string, { count: number; time: number }>;
  byHour: Record<number, number>;
  dailyStats: DailyStat[];
}

export interface DailyStat {
  date: string;
  totalMinutes: number;
  sessionCount: number;
  completedCount: number;
}

export interface TimerState {
  status: 'idle' | 'running' | 'paused' | 'completed';
  remainingMs: number;
  totalMs: number;
  sessionId?: string;
  endTime?: number;
  progress: number;
}

export interface HuntFlowDB extends DBSchema {
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

export interface HuntFlowExport {
  meta: {
    version: string;
    exportedAt: number;
    appVersion: string;
  };
  data: {
    sessions: Session[];
    notes: Note[];
    targets: Target[];
    payouts: Payout[];
    settings: Settings;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  defaultDuration: 1500,
  autoStartBreak: true,
  breakDuration: 300,
  sessionsBeforeLongBreak: 4,
  longBreakDuration: 900,
  soundEnabled: true,
  vibrationEnabled: true,
  theme: 'dark',
  accentColor: 'green',
  fontSize: 'medium',
  onboardingCompleted: false
};

export const BUILT_IN_TEMPLATES: NoteTemplate[] = [
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
