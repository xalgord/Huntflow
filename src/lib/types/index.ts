import type { DBSchema } from 'idb';

// ─── Core entities ───────────────────────────────────────────────────────────

export type Platform =
  | 'hackerone'
  | 'bugcrowd'
  | 'intigriti'
  | 'synack'
  | 'yeswehack'
  | 'self-hosted'
  | 'other';

export type Priority = 0 | 1 | 2 | 3;

export type TargetStatus =
  | 'recon'
  | 'testing'
  | 'reported'
  | 'paid'
  | 'closed'
  | 'archived';

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

export type SessionTag =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'needs-report'
  | 'duplicate'
  | 'informative'
  | 'wont-fix';

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

export type TemplateCategory =
  | 'web'
  | 'mobile'
  | 'api'
  | 'cloud'
  | 'network'
  | 'general';

export interface NoteTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  content: string;
  isBuiltIn: boolean;
  isCustom?: boolean;
}

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
  /** Optional link to the originating submission. */
  submissionId?: string;
}

// ─── Evidence vault ──────────────────────────────────────────────────────────

export type EvidenceAssetKind =
  | 'image'
  | 'pdf'
  | 'text'
  | 'request'
  | 'response'
  | 'archive'
  | 'binary'
  | 'url';

export type EvidenceAssetSource = 'upload' | 'clipboard' | 'snippet' | 'url';
export type EvidenceSyncState = 'local' | 'pending-upload' | 'synced' | 'remote' | 'error';
export type EvidenceNodeType = 'target' | 'session' | 'note' | 'asset' | 'url';
export type EvidenceRelationship =
  | 'proves'
  | 'references'
  | 'derived-from'
  | 'blocks'
  | 'duplicates'
  | 'belongs-to';

export interface EvidenceAsset {
  id: string;
  title: string;
  kind: EvidenceAssetKind;
  source: EvidenceAssetSource;
  mimeType: string;
  size: number;
  fileName?: string;
  relativePath?: string;
  folderPath?: string;
  description?: string;
  url?: string;
  textContent?: string;
  storageId?: string;
  localBlobId?: string;
  targetId?: string;
  sessionId?: string;
  noteId?: string;
  tags: string[];
  syncState: EvidenceSyncState;
  syncError?: string;
  capturedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface EvidenceBlob {
  assetId: string;
  data: Blob;
  size: number;
  mimeType: string;
  updatedAt: number;
}

export interface EvidenceLink {
  id: string;
  fromType: EvidenceNodeType;
  fromId: string;
  toType: EvidenceNodeType;
  toId: string;
  fromKey: string;
  toKey: string;
  relationship: EvidenceRelationship;
  label?: string;
  createdAt: number;
  updatedAt: number;
}

export interface EvidenceCanvasPosition {
  x: number;
  y: number;
}

export interface EvidenceCanvasView {
  id: string;
  name: string;
  targetId?: string;
  includeSessions: boolean;
  includeNotes: boolean;
  includeUrls: boolean;
  positions: Record<string, EvidenceCanvasPosition>;
  zoom: number;
  panX: number;
  panY: number;
  createdAt: number;
  updatedAt: number;
}

// ─── New: Recon inventory ────────────────────────────────────────────────────

export type ReconAssetStatus =
  | 'untested'
  | 'in-progress'
  | 'tested'
  | 'vulnerable'
  | 'out-of-scope'
  | 'dead';

export type ReconAssetSource =
  | 'manual'
  | 'import'
  | 'httpx'
  | 'subfinder'
  | 'amass'
  | 'crt-sh'
  | 'wayback'
  | 'other';

export interface ReconAsset {
  id: string;
  targetId: string;
  /** Primary identifier — host, subdomain, or path-less origin. */
  hostname: string;
  /** Optional canonical URL when discovered via httpx/wayback/etc. */
  url?: string;
  /** Resolved IPv4/IPv6 address. */
  ipAddress?: string;
  status: ReconAssetStatus;
  inScope: boolean;
  httpStatus?: number;
  /** Page title returned during fingerprinting. */
  title?: string;
  technologies: string[];
  ports?: number[];
  notes?: string;
  source?: ReconAssetSource;
  /** When the asset was first seen. */
  discoveredAt: number;
  /** When this asset was last manually retested. */
  lastTestedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// ─── New: Payload library ────────────────────────────────────────────────────

export type PayloadCategory =
  | 'xss'
  | 'sqli'
  | 'nosqli'
  | 'ssrf'
  | 'xxe'
  | 'ssti'
  | 'lfi'
  | 'rce'
  | 'cmd-injection'
  | 'auth-bypass'
  | 'open-redirect'
  | 'idor'
  | 'csrf'
  | 'deserialization'
  | 'graphql'
  | 'jwt'
  | 'oauth'
  | 'crlf'
  | 'prototype-pollution'
  | 'header-injection'
  | 'race-condition'
  | 'recon'
  | 'wordlist'
  | 'other';

export interface Payload {
  id: string;
  /** Human-readable name shown in the library. */
  name: string;
  category: PayloadCategory;
  /** The actual payload string the user copies. */
  payload: string;
  description?: string;
  tags: string[];
  language?: string;
  context?: string;
  source?: string;
  isBuiltIn: boolean;
  isFavorite: boolean;
  useCount: number;
  lastUsedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// ─── New: Methodology checklists ─────────────────────────────────────────────

export type ChecklistKind = 'web' | 'api' | 'mobile' | 'cloud' | 'network' | 'recon' | 'custom';

export interface ChecklistTemplateItem {
  id: string;
  /** Human-readable test description shown in the checklist UI. */
  title: string;
  description?: string;
  /** Optional links to OWASP/PortSwigger/HackTricks references. */
  references?: string[];
  severityHint?: PayoutSeverity;
}

export interface ChecklistTemplateSection {
  id: string;
  title: string;
  items: ChecklistTemplateItem[];
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  kind: ChecklistKind;
  description?: string;
  sections: ChecklistTemplateSection[];
  isBuiltIn: boolean;
  source?: string;
  createdAt: number;
  updatedAt: number;
}

export type ChecklistItemStatus = 'todo' | 'in-progress' | 'done' | 'na' | 'found';

export interface ChecklistInstanceItemState {
  status: ChecklistItemStatus;
  /** Free-form notes attached to this checklist item. */
  notes?: string;
  /** Optional cross-link to an evidence asset documenting the finding. */
  evidenceAssetId?: string;
  /** Optional cross-link to a note for the longer write-up. */
  noteId?: string;
  /** Severity recorded when the user marks the item as `found`. */
  severity?: PayoutSeverity;
  updatedAt: number;
}

export interface ChecklistInstance {
  id: string;
  templateId: string;
  targetId: string;
  /** Snapshot of template name at creation time. */
  templateName: string;
  /** Snapshot of template kind at creation time. */
  templateKind: ChecklistKind;
  /** Per-item state keyed by ChecklistTemplateItem.id. */
  itemStates: Record<string, ChecklistInstanceItemState>;
  notes?: string;
  /** Set when every item is `done`/`na`/`found`. Cleared when user reopens an item. */
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// ─── New: Submissions tracker ───────────────────────────────────────────────

export type SubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'triaged'
  | 'accepted'
  | 'duplicate'
  | 'informational'
  | 'not-applicable'
  | 'resolved'
  | 'rewarded'
  | 'closed';

export interface SubmissionTimelineEntry {
  id: string;
  status: SubmissionStatus;
  at: number;
  note?: string;
}

export interface Submission {
  id: string;
  title: string;
  targetId: string;
  noteId?: string;
  platform: Platform;
  vulnerabilityType?: string;
  severity: PayoutSeverity;
  cvssScore?: number;
  cvssVector?: string;
  reportUrl?: string;
  reportMarkdown?: string;
  status: SubmissionStatus;
  /** When the report was sent to the program. */
  submittedAt?: number;
  triagedAt?: number;
  resolvedAt?: number;
  rewardedAt?: number;
  /** Total bounty awarded across one or more linked Payouts. */
  bountyAmount?: number;
  payoutIds: string[];
  duplicateOf?: string;
  notes?: string;
  tags: string[];
  timeline: SubmissionTimelineEntry[];
  createdAt: number;
  updatedAt: number;
}

// ─── New: Bookmarks library ─────────────────────────────────────────────────

export type BookmarkCategory =
  | 'methodology'
  | 'cheatsheet'
  | 'tools'
  | 'recon'
  | 'cve'
  | 'xss'
  | 'sqli'
  | 'ssrf'
  | 'xxe'
  | 'ssti'
  | 'lfi'
  | 'rce'
  | 'auth'
  | 'idor'
  | 'jwt'
  | 'oauth'
  | 'graphql'
  | 'mobile'
  | 'general';

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  category: BookmarkCategory;
  /** Optional cross-link to a payload/vuln category for filtering. */
  vulnClass?: PayloadCategory;
  description?: string;
  tags: string[];
  isBuiltIn: boolean;
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
}

// ─── CVSS ────────────────────────────────────────────────────────────────────

export type CvssBaseSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface CvssVector {
  version: '3.0' | '3.1';
  vectorString: string;
  baseScore: number;
  baseSeverity: CvssBaseSeverity;
}

// ─── Settings & stats ────────────────────────────────────────────────────────

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

export interface DailyStat {
  date: string;
  totalMinutes: number;
  sessionCount: number;
  completedCount: number;
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

export interface TimerState {
  status: 'idle' | 'running' | 'paused' | 'completed';
  remainingMs: number;
  totalMs: number;
  sessionId?: string;
  endTime?: number;
  progress: number;
}

// ─── IndexedDB schema ────────────────────────────────────────────────────────

export interface HuntFlowDB extends DBSchema {
  sessions: {
    key: string;
    value: Session;
    indexes: { 'by-target': string; 'by-started': number; 'by-status': string };
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
  evidenceAssets: {
    key: string;
    value: EvidenceAsset;
    indexes: {
      'by-target': string;
      'by-session': string;
      'by-note': string;
      'by-kind': string;
      'by-tags': string;
      'by-sync-state': string;
      'by-updated': number;
    };
  };
  evidenceBlobs: {
    key: string;
    value: EvidenceBlob;
    indexes: { 'by-updated': number };
  };
  evidenceLinks: {
    key: string;
    value: EvidenceLink;
    indexes: {
      'by-from': string;
      'by-to': string;
      'by-relationship': string;
      'by-updated': number;
    };
  };
  evidenceCanvasViews: {
    key: string;
    value: EvidenceCanvasView;
    indexes: { 'by-target': string; 'by-updated': number };
  };
  templates: {
    key: string;
    value: NoteTemplate;
    indexes: { 'by-category': string };
  };
  reconAssets: {
    key: string;
    value: ReconAsset;
    indexes: { 'by-target': string; 'by-status': string; 'by-updated': number };
  };
  payloads: {
    key: string;
    value: Payload;
    indexes: { 'by-category': string; 'by-tags': string; 'by-updated': number };
  };
  checklistTemplates: {
    key: string;
    value: ChecklistTemplate;
    indexes: { 'by-kind': string; 'by-updated': number };
  };
  checklistInstances: {
    key: string;
    value: ChecklistInstance;
    indexes: { 'by-target': string; 'by-template': string; 'by-updated': number };
  };
  submissions: {
    key: string;
    value: Submission;
    indexes: {
      'by-target': string;
      'by-status': string;
      'by-platform': string;
      'by-severity': string;
      'by-submittedAt': number;
      'by-updated': number;
    };
  };
  bookmarks: {
    key: string;
    value: Bookmark;
    indexes: { 'by-category': string; 'by-tags': string; 'by-updated': number };
  };
  settings: {
    key: string;
    value: AppSettings;
  };
}

// ─── Export/Import format ────────────────────────────────────────────────────

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
    evidenceAssets?: EvidenceAsset[];
    evidenceLinks?: EvidenceLink[];
    evidenceCanvasViews?: EvidenceCanvasView[];
    reconAssets?: ReconAsset[];
    payloads?: Payload[];
    checklistTemplates?: ChecklistTemplate[];
    checklistInstances?: ChecklistInstance[];
    submissions?: Submission[];
    bookmarks?: Bookmark[];
    settings: Settings;
  };
}

// ─── Built-in templates ──────────────────────────────────────────────────────

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
