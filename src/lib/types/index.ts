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
  /**
   * Hunter-mode metadata. Severity lets you tag a finding while it's
   * fresh; CVSS vector/score is calculated inline via the same calculator
   * used by submissions, so promote-to-submission can carry it across
   * without re-typing.
   */
  severity?: PayoutSeverity;
  cvssVector?: string;
  cvssScore?: number;
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
  /**
   * A complete HTTP exchange (request + optional response) captured as
   * one inseparable artifact. This is the format real bug hunters paste
   * out of Burp/Caido/curl — keeping it single-rowed avoids the awkward
   * "two assets manually linked with derived-from" pattern.
   */
  | 'http-exchange'
  | 'archive'
  | 'binary'
  | 'url';

/**
 * Structured metadata for an `http-exchange` evidence asset. Both raw
 * blobs are kept verbatim so the "copy as curl"/"download as .http"
 * actions stay byte-identical to what the hunter saw on the wire.
 */
export interface HttpExchangeMeta {
  method: string;
  url: string;
  host?: string;
  httpVersion?: string;
  statusCode?: number;
  statusText?: string;
  durationMs?: number;
  requestRaw?: string;
  responseRaw?: string;
}

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
  /** Parsed HTTP fields when `kind === 'http-exchange'`. */
  httpExchange?: HttpExchangeMeta;
  syncState: EvidenceSyncState;
  syncError?: string;
  capturedAt: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Binary payload for an EvidenceAsset.
 *
 * The runtime convention used across the rest of the codebase (assets
 * page, cloud sync, asset preview/download) is `blob:` plus optional
 * `fileName` / `relativePath` / `createdAt`. The earlier `data:` field
 * was kept only for backward compatibility with the very first export
 * format and is now resolved at the call site that needs it.
 */
export interface EvidenceBlob {
  assetId: string;
  blob: Blob;
  size: number;
  mimeType: string;
  fileName?: string;
  relativePath?: string;
  createdAt?: number;
  updatedAt: number;
  /** @deprecated legacy field — newer code uses `blob`. */
  data?: Blob;
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
  | 'safe'
  | 'vulnerable'
  | 'out-of-scope'
  | 'dead';

export type TargetAssetType = 'web' | 'api' | 'mobile' | 'cloud' | 'source-code' | 'other';

export type ScopeStatus = 'in-scope' | 'out-of-scope' | 'unknown';

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
  /** Optional command-center classification for first-class Targets page UX. */
  assetType?: TargetAssetType;
  /** Optional scope state. Older workspaces use `inScope` as the fallback. */
  scopeStatus?: ScopeStatus;
  /** Optional target priority, mirroring program priority scale. */
  priority?: Priority;
  status: ReconAssetStatus;
  inScope: boolean;
  httpStatus?: number;
  /** Page title returned during fingerprinting. */
  title?: string;
  technologies: string[];
  ports?: number[];
  notes?: string;
  source?: ReconAssetSource;
  tags?: string[];
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
  /** Timestamp when the user first started working on this instance. */
  startedAt?: number;
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
  | 'writeup'
  | 'cve'
  | 'tool'
  | 'tools'
  | 'docs'
  | 'cheatsheet'
  | 'video'
  | 'paper'
  | 'blog'
  | 'other'
  | 'methodology'
  | 'recon'
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
      'by-target': string;
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

/**
 * Two flavours of templates ship by default:
 *
 * 1. **Probe logs** — what a hunter wants while actively testing. These
 *    are matrix/checklist-shaped: "did I try X with encoding Y in
 *    context Z?" They're cheap to fill in real-time and become the
 *    bones of the report later.
 * 2. **Reports** — write-up skeletons (Impact / Remediation / Proof)
 *    used when the bug is confirmed and you're packaging it up for
 *    submission.
 *
 * Templates are seeded once on first DB init and `put` is upsert-safe,
 * so adding entries here automatically propagates to existing users.
 */
export const BUILT_IN_TEMPLATES: NoteTemplate[] = [
  // ─── Probe-log templates (live hunting) ──────────────────────────────
  {
    id: 'probe-xss-matrix',
    name: 'Probe — XSS matrix',
    category: 'web',
    content: `## XSS Probe Matrix

### Endpoint
- URL:
- Method:
- Parameter(s):

### Reflection context
- [ ] HTML body
- [ ] HTML attribute (which: \`\`)
- [ ] JS string / template
- [ ] URL / href / src
- [ ] CSS context

### Payloads tried
| Payload | Encoding | Reflected? | Fired? | Notes |
|---|---|---|---|---|
| \`<svg/onload=alert(1)>\` | none |  |  |  |
| \`"><img src=x onerror=alert(1)>\` | none |  |  |  |
| \`javascript:alert(1)\` | none |  |  |  |
| \`'-alert(1)-'\` | js-string |  |  |  |

### Filters / WAF observed

### Working PoC

### CSP / cookie flags`,
    isBuiltIn: true
  },
  {
    id: 'probe-idor-sweep',
    name: 'Probe — IDOR endpoint sweep',
    category: 'web',
    content: `## IDOR Endpoint Sweep

### Account A (low-priv)
- User ID:
- Session token / cookie:

### Account B (low-priv, separate tenant if applicable)
- User ID:
- Session token / cookie:

### Endpoints tested
| Method | Endpoint | Param | A→B works? | Anon→A works? | Notes |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

### Privilege classes tried
- [ ] Anonymous → User
- [ ] User A → User B (same tenant)
- [ ] User → Admin
- [ ] Tenant A → Tenant B

### Findings`,
    isBuiltIn: true
  },
  {
    id: 'probe-ssrf-ladder',
    name: 'Probe — SSRF target ladder',
    category: 'web',
    content: `## SSRF Probe

### Vulnerable parameter
- Endpoint:
- Parameter:
- Original value:

### Ladder
- [ ] Custom collaborator domain (\`http://xxxxx.oastify.com\`)
- [ ] localhost (\`http://127.0.0.1\`, \`[::1]\`, \`0.0.0.0\`)
- [ ] localhost via redirect / DNS rebind
- [ ] Cloud metadata IPv4 (\`http://169.254.169.254/latest/meta-data/\`)
- [ ] IMDSv2 token endpoint
- [ ] Internal hostnames (\`kubernetes.default.svc\`, \`metadata.google.internal\`)
- [ ] \`file://\` scheme
- [ ] \`gopher://\` (unauth Redis / Memcached / SMTP)
- [ ] \`dict://\` / \`ftp://\`

### Response observations
| Probe | Status | Body length | Hint |
|---|---|---|---|
|  |  |  |  |

### Out-of-band hits

### Working chain`,
    isBuiltIn: true
  },
  {
    id: 'probe-auth-flow',
    name: 'Probe — Auth flow trace',
    category: 'web',
    content: `## Auth Flow Trace

### Flow type
- [ ] Login
- [ ] Signup
- [ ] Password reset
- [ ] OAuth (provider: )
- [ ] SSO / SAML
- [ ] MFA enrol / step-up

### Steps captured
1. Initial request:
2. Server response:
3. Token / cookie issued:
4. Subsequent request:

### Weakness checks
- [ ] Predictable / sequential token
- [ ] Token leaked in URL / Referer
- [ ] No rate limit on submit
- [ ] Account enumeration via timing or distinct error
- [ ] Token reuse after logout
- [ ] Mass assignment on signup payload
- [ ] OAuth state missing / replayable
- [ ] Open redirect in callback
- [ ] MFA bypass (skip step, downgrade method)

### Notes`,
    isBuiltIn: true
  },
  {
    id: 'probe-graphql',
    name: 'Probe — GraphQL introspection log',
    category: 'api',
    content: `## GraphQL Probe

### Endpoint
- URL:
- Auth required:

### Introspection
- [ ] Enabled in production
- [ ] Disabled but bypassable via field suggestions / aliasing
- [ ] Schema dumped to file (path: )

### Operations of interest
| Operation | Args | Auth required? | Returns sensitive data? |
|---|---|---|---|
|  |  |  |  |

### Techniques tried
- [ ] Batched query DoS
- [ ] Aliased rate-limit bypass
- [ ] Field duplication amplification
- [ ] Deeply nested / cyclic query
- [ ] CSRF on POST without preflight
- [ ] Mutation callable via GET
- [ ] Sensitive data leaked in errors
- [ ] Object/relay ID enumeration

### Findings`,
    isBuiltIn: true
  },
  {
    id: 'probe-race',
    name: 'Probe — Race condition repro',
    category: 'web',
    content: `## Race Condition Repro

### Endpoint
- Method / URL:
- Action it performs:

### Setup
- Account state before:
- Resource being raced:

### Tooling
- [ ] Burp Repeater group (parallel, last-byte sync)
- [ ] Turbo Intruder script
- [ ] HTTP/2 single-packet attack

### Attempts
| Concurrency | Successes | Notes |
|---|---|---|
|  |  |  |

### Outcome
- State that changed beyond intended count:
- Money / data / privilege impact:`,
    isBuiltIn: true
  },

  // ─── Report templates (write-up time) ────────────────────────────────
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
