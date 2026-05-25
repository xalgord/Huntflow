import { bookmarkDB } from './bookmarks';
import { checklistInstanceDB, checklistTemplateDB } from './checklists';
import { evidenceAssetDB, evidenceCanvasViewDB, evidenceLinkDB } from './evidence';
import { noteDB } from './notes';
import { payloadDB } from './payloads';
import { payoutDB } from './payouts';
import { reconAssetDB } from './recon';
import { sessionDB } from './sessions';
import { settingsDB } from './settings';
import { submissionDB } from './submissions';
import { targetDB } from './targets';
import {
  DEFAULT_SETTINGS,
  type Bookmark,
  type BookmarkCategory,
  type ChecklistInstance,
  type ChecklistInstanceItemState,
  type ChecklistItemStatus,
  type ChecklistKind,
  type ChecklistTemplate,
  type ChecklistTemplateItem,
  type ChecklistTemplateSection,
  type EvidenceAsset,
  type EvidenceAssetKind,
  type EvidenceAssetSource,
  type EvidenceCanvasView,
  type EvidenceLink,
  type EvidenceNodeType,
  type EvidenceRelationship,
  type EvidenceSyncState,
  type HuntFlowExport,
  type Note,
  type Payload,
  type PayloadCategory,
  type Payout,
  type PayoutSeverity,
  type PayoutStatus,
  type Platform,
  type Priority,
  type ReconAsset,
  type ReconAssetSource,
  type ReconAssetStatus,
  type ScopeStatus,
  type Session,
  type SessionTag,
  type Settings,
  type Submission,
  type SubmissionStatus,
  type SubmissionTimelineEntry,
  type Target,
  type TargetAssetType,
  type TargetStatus
} from './schema';

const SESSION_STATUSES: Session['status'][] = ['running', 'paused', 'completed', 'abandoned'];
const SESSION_TAGS: SessionTag[] = [
  'critical',
  'high',
  'medium',
  'low',
  'needs-report',
  'duplicate',
  'informative',
  'wont-fix'
];
const PLATFORMS: Platform[] = [
  'hackerone',
  'bugcrowd',
  'intigriti',
  'synack',
  'yeswehack',
  'self-hosted',
  'other'
];
const PRIORITIES: Priority[] = [0, 1, 2, 3];
const TARGET_STATUSES: TargetStatus[] = ['recon', 'testing', 'reported', 'paid', 'closed', 'archived'];
const PAYOUT_SEVERITIES: PayoutSeverity[] = ['critical', 'high', 'medium', 'low', 'informational'];
const PAYOUT_STATUSES: PayoutStatus[] = ['pending', 'triaged', 'paid'];
const EVIDENCE_KINDS: EvidenceAssetKind[] = ['image', 'pdf', 'text', 'request', 'response', 'http-exchange', 'archive', 'binary', 'url'];
const EVIDENCE_SOURCES: EvidenceAssetSource[] = ['upload', 'clipboard', 'snippet', 'url'];
const EVIDENCE_SYNC_STATES: EvidenceSyncState[] = ['local', 'pending-upload', 'synced', 'remote', 'error'];
const EVIDENCE_NODE_TYPES: EvidenceNodeType[] = ['target', 'session', 'note', 'asset', 'url'];
const EVIDENCE_RELATIONSHIPS: EvidenceRelationship[] = [
  'proves',
  'references',
  'derived-from',
  'blocks',
  'duplicates',
  'belongs-to'
];
const THEMES: Settings['theme'][] = ['light', 'dark', 'system'];
const ACCENT_COLORS: Settings['accentColor'][] = ['green', 'blue', 'orange', 'purple'];
const FONT_SIZES: Settings['fontSize'][] = ['small', 'medium', 'large'];
const RECON_ASSET_STATUSES: ReconAssetStatus[] = [
  'untested',
  'in-progress',
  'tested',
  'safe',
  'vulnerable',
  'out-of-scope',
  'dead'
];
const TARGET_ASSET_TYPES: TargetAssetType[] = ['web', 'api', 'mobile', 'cloud', 'source-code', 'other'];
const SCOPE_STATUSES: ScopeStatus[] = ['in-scope', 'out-of-scope', 'unknown'];
const RECON_ASSET_SOURCES: ReconAssetSource[] = [
  'manual',
  'import',
  'httpx',
  'subfinder',
  'amass',
  'crt-sh',
  'wayback',
  'other'
];
const PAYLOAD_CATEGORIES: PayloadCategory[] = [
  'xss',
  'sqli',
  'nosqli',
  'ssrf',
  'xxe',
  'ssti',
  'lfi',
  'rce',
  'cmd-injection',
  'auth-bypass',
  'open-redirect',
  'idor',
  'csrf',
  'deserialization',
  'graphql',
  'jwt',
  'oauth',
  'crlf',
  'prototype-pollution',
  'header-injection',
  'race-condition',
  'recon',
  'wordlist',
  'other'
];
const CHECKLIST_KINDS: ChecklistKind[] = ['web', 'api', 'mobile', 'cloud', 'network', 'recon', 'custom'];
const CHECKLIST_ITEM_STATUSES: ChecklistItemStatus[] = ['todo', 'in-progress', 'done', 'na', 'found'];
const SUBMISSION_STATUSES: SubmissionStatus[] = [
  'draft',
  'submitted',
  'triaged',
  'accepted',
  'duplicate',
  'informational',
  'not-applicable',
  'resolved',
  'rewarded',
  'closed'
];
const BOOKMARK_CATEGORIES: BookmarkCategory[] = [
  'writeup',
  'cve',
  'tool',
  'tools',
  'docs',
  'cheatsheet',
  'video',
  'paper',
  'blog',
  'other',
  'methodology',
  'recon',
  'xss',
  'sqli',
  'ssrf',
  'xxe',
  'ssti',
  'lfi',
  'rce',
  'auth',
  'idor',
  'jwt',
  'oauth',
  'graphql',
  'mobile',
  'general'
];

export class ImportValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(`Invalid HuntFlow import:\n${errors.join('\n')}`);
    this.name = 'ImportValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}

function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidTag(tag: string): boolean {
  return /^[a-z0-9_-]{1,30}$/i.test(tag);
}

function parsePayload(payload: unknown): unknown {
  if (typeof payload !== 'string') return payload;

  try {
    return JSON.parse(payload) as unknown;
  } catch {
    throw new ImportValidationError(['Import payload is not valid JSON']);
  }
}

function validateSettings(value: unknown, errors: string[]): Settings {
  if (!isRecord(value)) {
    errors.push('data.settings must be an object');
    return DEFAULT_SETTINGS;
  }

  const settings = { ...DEFAULT_SETTINGS, ...value } as Record<string, unknown>;

  if (!isNumber(settings.defaultDuration) || settings.defaultDuration <= 0) {
    errors.push('settings.defaultDuration must be a positive number');
  }
  if (!isBoolean(settings.autoStartBreak)) errors.push('settings.autoStartBreak must be a boolean');
  if (!isNumber(settings.breakDuration) || settings.breakDuration <= 0) {
    errors.push('settings.breakDuration must be a positive number');
  }
  if (!isNumber(settings.sessionsBeforeLongBreak) || settings.sessionsBeforeLongBreak <= 0) {
    errors.push('settings.sessionsBeforeLongBreak must be a positive number');
  }
  if (!isNumber(settings.longBreakDuration) || settings.longBreakDuration <= 0) {
    errors.push('settings.longBreakDuration must be a positive number');
  }
  if (!isBoolean(settings.soundEnabled)) errors.push('settings.soundEnabled must be a boolean');
  if (!isBoolean(settings.vibrationEnabled)) errors.push('settings.vibrationEnabled must be a boolean');
  if (!THEMES.includes(settings.theme as Settings['theme'])) errors.push('settings.theme is invalid');
  if (!ACCENT_COLORS.includes(settings.accentColor as Settings['accentColor'])) {
    errors.push('settings.accentColor is invalid');
  }
  if (!FONT_SIZES.includes(settings.fontSize as Settings['fontSize'])) {
    errors.push('settings.fontSize is invalid');
  }
  if (!isBoolean(settings.onboardingCompleted)) {
    errors.push('settings.onboardingCompleted must be a boolean');
  }
  if (settings.lastExportAt !== undefined && !isNumber(settings.lastExportAt)) {
    errors.push('settings.lastExportAt must be a number when provided');
  }

  return settings as unknown as Settings;
}

function validateTarget(value: unknown, index: number, errors: string[]): Target | null {
  if (!isRecord(value)) {
    errors.push(`targets[${index}] must be an object`);
    return null;
  }

  const target = value as Partial<Target>;

  if (!isString(target.id) || !isValidUUID(target.id)) errors.push(`targets[${index}].id is invalid`);
  if (!isString(target.name) || target.name.trim().length === 0 || target.name.length > 100) {
    errors.push(`targets[${index}].name must be 1-100 characters`);
  }
  if (!PLATFORMS.includes(target.platform as Platform)) {
    errors.push(`targets[${index}].platform is invalid`);
  }
  if (target.programUrl !== undefined && (!isString(target.programUrl) || !isValidURL(target.programUrl))) {
    errors.push(`targets[${index}].programUrl is invalid`);
  }
  if (!isString(target.scope) || target.scope.length > 5000) {
    errors.push(`targets[${index}].scope must be a string <= 5000 characters`);
  }
  if (!isString(target.notes) || target.notes.length > 10000) {
    errors.push(`targets[${index}].notes must be a string <= 10000 characters`);
  }
  if (!PRIORITIES.includes(target.priority as Priority)) {
    errors.push(`targets[${index}].priority is invalid`);
  }
  if (!TARGET_STATUSES.includes(target.status as TargetStatus)) {
    errors.push(`targets[${index}].status is invalid`);
  }
  if (!isNumber(target.createdAt)) errors.push(`targets[${index}].createdAt must be a number`);
  if (!isNumber(target.updatedAt)) errors.push(`targets[${index}].updatedAt must be a number`);
  if (target.lastSessionAt !== undefined && !isNumber(target.lastSessionAt)) {
    errors.push(`targets[${index}].lastSessionAt must be a number when provided`);
  }
  if (!isNumber(target.sessionCount) || target.sessionCount < 0) {
    errors.push(`targets[${index}].sessionCount must be a non-negative number`);
  }

  return target as Target;
}

function validateSession(
  value: unknown,
  index: number,
  targetIds: Set<string>,
  errors: string[]
): Session | null {
  if (!isRecord(value)) {
    errors.push(`sessions[${index}] must be an object`);
    return null;
  }

  const session = value as Partial<Session>;

  if (!isString(session.id) || !isValidUUID(session.id)) errors.push(`sessions[${index}].id is invalid`);
  if (!isString(session.targetId) || !targetIds.has(session.targetId)) {
    errors.push(`sessions[${index}].targetId must reference an imported or existing target`);
  }
  if (session.templateId !== undefined && !isString(session.templateId)) {
    errors.push(`sessions[${index}].templateId must be a string when provided`);
  }
  if (!isNumber(session.durationPlanned) || session.durationPlanned <= 0 || session.durationPlanned > 14400) {
    errors.push(`sessions[${index}].durationPlanned must be between 1 and 14400 seconds`);
  }
  if (
    !isNumber(session.durationActual) ||
    session.durationActual < 0 ||
    (isNumber(session.durationPlanned) && session.durationActual > session.durationPlanned)
  ) {
    errors.push(`sessions[${index}].durationActual is invalid`);
  }
  if (!isNumber(session.startedAt) || session.startedAt > Date.now()) {
    errors.push(`sessions[${index}].startedAt is invalid`);
  }
  if (session.endedAt !== undefined) {
    if (!isNumber(session.endedAt) || (isNumber(session.startedAt) && session.endedAt < session.startedAt)) {
      errors.push(`sessions[${index}].endedAt is invalid`);
    }
  }
  if (!SESSION_STATUSES.includes(session.status as Session['status'])) {
    errors.push(`sessions[${index}].status is invalid`);
  }
  if (
    session.status === 'abandoned' &&
    isNumber(session.durationActual) &&
    isNumber(session.durationPlanned) &&
    session.durationActual >= session.durationPlanned * 0.5
  ) {
    errors.push(`sessions[${index}].status can be abandoned only before 50% completion`);
  }
  if (session.quickNote !== undefined && !isString(session.quickNote)) {
    errors.push(`sessions[${index}].quickNote must be a string when provided`);
  }
  if (!Array.isArray(session.tags) || session.tags.length > 5) {
    errors.push(`sessions[${index}].tags must contain at most 5 tags`);
  } else {
    for (const tag of session.tags) {
      if (!SESSION_TAGS.includes(tag as SessionTag)) {
        errors.push(`sessions[${index}].tags contains invalid tag "${String(tag)}"`);
      }
    }
  }

  return session as Session;
}

function validateNote(
  value: unknown,
  index: number,
  targetIds: Set<string>,
  sessionIds: Set<string>,
  errors: string[]
): Note | null {
  if (!isRecord(value)) {
    errors.push(`notes[${index}] must be an object`);
    return null;
  }

  const note = value as Partial<Note>;

  if (!isString(note.id) || !isValidUUID(note.id)) errors.push(`notes[${index}].id is invalid`);
  if (!isString(note.title) || note.title.trim().length === 0 || note.title.length > 200) {
    errors.push(`notes[${index}].title must be 1-200 characters`);
  }
  if (!isString(note.content) || note.content.length > 50000) {
    errors.push(`notes[${index}].content must be a string <= 50000 characters`);
  }
  if (!isString(note.targetId) || !targetIds.has(note.targetId)) {
    errors.push(`notes[${index}].targetId must reference an imported or existing target`);
  }
  if (note.sessionId !== undefined && (!isString(note.sessionId) || !sessionIds.has(note.sessionId))) {
    errors.push(`notes[${index}].sessionId must reference an imported or existing session`);
  }
  if (note.templateId !== undefined && !isString(note.templateId)) {
    errors.push(`notes[${index}].templateId must be a string when provided`);
  }
  if (!Array.isArray(note.tags) || note.tags.length > 10) {
    errors.push(`notes[${index}].tags must contain at most 10 tags`);
  } else {
    for (const tag of note.tags) {
      if (!isString(tag) || !isValidTag(tag)) {
        errors.push(`notes[${index}].tags contains invalid tag "${String(tag)}"`);
      }
    }
  }
  if (!isNumber(note.createdAt)) errors.push(`notes[${index}].createdAt must be a number`);
  if (!isNumber(note.updatedAt)) errors.push(`notes[${index}].updatedAt must be a number`);

  return note as Note;
}

function validatePayout(value: unknown, index: number, errors: string[]): Payout | null {
  if (!isRecord(value)) {
    errors.push(`payouts[${index}] must be an object`);
    return null;
  }

  const payout = value as Partial<Payout>;

  if (!isString(payout.id) || !isValidUUID(payout.id)) errors.push(`payouts[${index}].id is invalid`);
  if (!isString(payout.program) || payout.program.trim().length === 0 || payout.program.length > 100) {
    errors.push(`payouts[${index}].program must be 1-100 characters`);
  }
  if (!PLATFORMS.includes(payout.platform as Platform)) {
    errors.push(`payouts[${index}].platform is invalid`);
  }
  if (!PAYOUT_SEVERITIES.includes(payout.severity as PayoutSeverity)) {
    errors.push(`payouts[${index}].severity is invalid`);
  }
  if (!isNumber(payout.amount) || payout.amount <= 0) {
    errors.push(`payouts[${index}].amount must be a positive number`);
  }
  if (!isNumber(payout.date)) errors.push(`payouts[${index}].date must be a number`);
  if (!PAYOUT_STATUSES.includes(payout.status as PayoutStatus)) {
    errors.push(`payouts[${index}].status is invalid`);
  }
  if (!isNumber(payout.createdAt)) errors.push(`payouts[${index}].createdAt must be a number`);
  if (!isNumber(payout.updatedAt)) errors.push(`payouts[${index}].updatedAt must be a number`);

  return payout as Payout;
}

function validateEvidenceAsset(
  value: unknown,
  index: number,
  targetIds: Set<string>,
  sessionIds: Set<string>,
  noteIds: Set<string>,
  errors: string[]
): EvidenceAsset | null {
  if (!isRecord(value)) {
    errors.push(`evidenceAssets[${index}] must be an object`);
    return null;
  }

  const asset = value as Partial<EvidenceAsset>;

  if (!isString(asset.id) || !isValidUUID(asset.id)) errors.push(`evidenceAssets[${index}].id is invalid`);
  if (!isString(asset.title) || asset.title.trim().length === 0 || asset.title.length > 160) {
    errors.push(`evidenceAssets[${index}].title must be 1-160 characters`);
  }
  if (!EVIDENCE_KINDS.includes(asset.kind as EvidenceAssetKind)) {
    errors.push(`evidenceAssets[${index}].kind is invalid`);
  }
  if (!EVIDENCE_SOURCES.includes(asset.source as EvidenceAssetSource)) {
    errors.push(`evidenceAssets[${index}].source is invalid`);
  }
  if (!isString(asset.mimeType) || asset.mimeType.length > 120) {
    errors.push(`evidenceAssets[${index}].mimeType must be a string <= 120 characters`);
  }
  if (!isNumber(asset.size) || asset.size < 0) {
    errors.push(`evidenceAssets[${index}].size must be a non-negative number`);
  }
  if (asset.fileName !== undefined && (!isString(asset.fileName) || asset.fileName.length > 220)) {
    errors.push(`evidenceAssets[${index}].fileName must be <= 220 characters when provided`);
  }
  if (asset.relativePath !== undefined && (!isString(asset.relativePath) || asset.relativePath.length > 1000)) {
    errors.push(`evidenceAssets[${index}].relativePath must be <= 1000 characters when provided`);
  }
  if (asset.folderPath !== undefined && (!isString(asset.folderPath) || asset.folderPath.length > 900)) {
    errors.push(`evidenceAssets[${index}].folderPath must be <= 900 characters when provided`);
  }
  if (asset.description !== undefined && (!isString(asset.description) || asset.description.length > 2000)) {
    errors.push(`evidenceAssets[${index}].description must be <= 2000 characters when provided`);
  }
  if (asset.url !== undefined && (!isString(asset.url) || !isValidURL(asset.url))) {
    errors.push(`evidenceAssets[${index}].url must be valid when provided`);
  }
  if (asset.source === 'url' && !asset.url) {
    errors.push(`evidenceAssets[${index}].url is required for URL assets`);
  }
  if (asset.textContent !== undefined && (!isString(asset.textContent) || asset.textContent.length > 100000)) {
    errors.push(`evidenceAssets[${index}].textContent must be <= 100000 characters when provided`);
  }
  if (asset.storageId !== undefined && !isString(asset.storageId)) {
    errors.push(`evidenceAssets[${index}].storageId must be a string when provided`);
  }
  if (asset.localBlobId !== undefined && !isString(asset.localBlobId)) {
    errors.push(`evidenceAssets[${index}].localBlobId must be a string when provided`);
  }
  if (asset.targetId !== undefined && (!isString(asset.targetId) || !targetIds.has(asset.targetId))) {
    errors.push(`evidenceAssets[${index}].targetId must reference an imported or existing target`);
  }
  if (asset.sessionId !== undefined && (!isString(asset.sessionId) || !sessionIds.has(asset.sessionId))) {
    errors.push(`evidenceAssets[${index}].sessionId must reference an imported or existing session`);
  }
  if (asset.noteId !== undefined && (!isString(asset.noteId) || !noteIds.has(asset.noteId))) {
    errors.push(`evidenceAssets[${index}].noteId must reference an imported or existing note`);
  }
  if (!Array.isArray(asset.tags) || asset.tags.length > 12) {
    errors.push(`evidenceAssets[${index}].tags must contain at most 12 tags`);
  } else {
    for (const tag of asset.tags) {
      if (!isString(tag) || !isValidTag(tag)) {
        errors.push(`evidenceAssets[${index}].tags contains invalid tag "${String(tag)}"`);
      }
    }
  }
  if (!EVIDENCE_SYNC_STATES.includes(asset.syncState as EvidenceSyncState)) {
    errors.push(`evidenceAssets[${index}].syncState is invalid`);
  }
  if (asset.syncError !== undefined && (!isString(asset.syncError) || asset.syncError.length > 500)) {
    errors.push(`evidenceAssets[${index}].syncError must be <= 500 characters when provided`);
  }
  if (!isNumber(asset.capturedAt)) errors.push(`evidenceAssets[${index}].capturedAt must be a number`);
  if (!isNumber(asset.createdAt)) errors.push(`evidenceAssets[${index}].createdAt must be a number`);
  if (!isNumber(asset.updatedAt)) errors.push(`evidenceAssets[${index}].updatedAt must be a number`);

  return asset as EvidenceAsset;
}

function nodeExists(type: EvidenceNodeType, id: string, refs: {
  targetIds: Set<string>;
  sessionIds: Set<string>;
  noteIds: Set<string>;
  assetIds: Set<string>;
}): boolean {
  if (type === 'target') return refs.targetIds.has(id);
  if (type === 'session') return refs.sessionIds.has(id);
  if (type === 'note') return refs.noteIds.has(id);
  return refs.assetIds.has(id);
}

function validateEvidenceLink(
  value: unknown,
  index: number,
  refs: {
    targetIds: Set<string>;
    sessionIds: Set<string>;
    noteIds: Set<string>;
    assetIds: Set<string>;
  },
  errors: string[]
): EvidenceLink | null {
  if (!isRecord(value)) {
    errors.push(`evidenceLinks[${index}] must be an object`);
    return null;
  }

  const link = value as Partial<EvidenceLink>;

  if (!isString(link.id) || !isValidUUID(link.id)) errors.push(`evidenceLinks[${index}].id is invalid`);
  if (!EVIDENCE_NODE_TYPES.includes(link.fromType as EvidenceNodeType)) {
    errors.push(`evidenceLinks[${index}].fromType is invalid`);
  }
  if (!isString(link.fromId) || !nodeExists(link.fromType as EvidenceNodeType, link.fromId, refs)) {
    errors.push(`evidenceLinks[${index}].fromId must reference an existing graph node`);
  }
  if (!EVIDENCE_NODE_TYPES.includes(link.toType as EvidenceNodeType)) {
    errors.push(`evidenceLinks[${index}].toType is invalid`);
  }
  if (!isString(link.toId) || !nodeExists(link.toType as EvidenceNodeType, link.toId, refs)) {
    errors.push(`evidenceLinks[${index}].toId must reference an existing graph node`);
  }
  if (!EVIDENCE_RELATIONSHIPS.includes(link.relationship as EvidenceRelationship)) {
    errors.push(`evidenceLinks[${index}].relationship is invalid`);
  }
  if (link.label !== undefined && (!isString(link.label) || link.label.length > 120)) {
    errors.push(`evidenceLinks[${index}].label must be <= 120 characters when provided`);
  }
  if (!isNumber(link.createdAt)) errors.push(`evidenceLinks[${index}].createdAt must be a number`);
  if (!isNumber(link.updatedAt)) errors.push(`evidenceLinks[${index}].updatedAt must be a number`);

  return {
    ...(link as EvidenceLink),
    fromKey: `${link.fromType}:${link.fromId}`,
    toKey: `${link.toType}:${link.toId}`
  };
}

function validateEvidenceCanvasView(
  value: unknown,
  index: number,
  targetIds: Set<string>,
  errors: string[]
): EvidenceCanvasView | null {
  if (!isRecord(value)) {
    errors.push(`evidenceCanvasViews[${index}] must be an object`);
    return null;
  }

  const view = value as Partial<EvidenceCanvasView>;

  if (!isString(view.id) || !isValidUUID(view.id)) errors.push(`evidenceCanvasViews[${index}].id is invalid`);
  if (!isString(view.name) || view.name.trim().length === 0 || view.name.length > 80) {
    errors.push(`evidenceCanvasViews[${index}].name must be 1-80 characters`);
  }
  if (view.targetId !== undefined && (!isString(view.targetId) || !targetIds.has(view.targetId))) {
    errors.push(`evidenceCanvasViews[${index}].targetId must reference an imported or existing target`);
  }
  if (!isBoolean(view.includeSessions)) errors.push(`evidenceCanvasViews[${index}].includeSessions must be a boolean`);
  if (!isBoolean(view.includeNotes)) errors.push(`evidenceCanvasViews[${index}].includeNotes must be a boolean`);
  if (!isBoolean(view.includeUrls)) errors.push(`evidenceCanvasViews[${index}].includeUrls must be a boolean`);
  if (!isRecord(view.positions)) {
    errors.push(`evidenceCanvasViews[${index}].positions must be an object`);
  } else {
    for (const [key, position] of Object.entries(view.positions)) {
      if (!isRecord(position) || !isNumber(position.x) || !isNumber(position.y)) {
        errors.push(`evidenceCanvasViews[${index}].positions.${key} must contain numeric x and y`);
      }
    }
  }
  if (!isNumber(view.zoom) || view.zoom <= 0 || view.zoom > 4) {
    errors.push(`evidenceCanvasViews[${index}].zoom must be between 0 and 4`);
  }
  if (!isNumber(view.panX)) errors.push(`evidenceCanvasViews[${index}].panX must be a number`);
  if (!isNumber(view.panY)) errors.push(`evidenceCanvasViews[${index}].panY must be a number`);
  if (!isNumber(view.createdAt)) errors.push(`evidenceCanvasViews[${index}].createdAt must be a number`);
  if (!isNumber(view.updatedAt)) errors.push(`evidenceCanvasViews[${index}].updatedAt must be a number`);

  return view as EvidenceCanvasView;
}

function validateReconAsset(
  value: unknown,
  index: number,
  targetIds: Set<string>,
  errors: string[]
): ReconAsset | null {
  if (!isRecord(value)) {
    errors.push(`reconAssets[${index}] must be an object`);
    return null;
  }

  const asset = value as Partial<ReconAsset>;

  if (!isString(asset.id) || !isValidUUID(asset.id)) errors.push(`reconAssets[${index}].id is invalid`);
  if (!isString(asset.targetId) || !targetIds.has(asset.targetId)) {
    errors.push(`reconAssets[${index}].targetId must reference an imported or existing target`);
  }
  if (!isString(asset.hostname) || asset.hostname.trim().length === 0 || asset.hostname.length > 500) {
    errors.push(`reconAssets[${index}].hostname must be 1-500 characters`);
  }
  if (asset.url !== undefined && (!isString(asset.url) || !isValidURL(asset.url))) {
    errors.push(`reconAssets[${index}].url must be valid when provided`);
  }
  if (asset.ipAddress !== undefined && !isString(asset.ipAddress)) {
    errors.push(`reconAssets[${index}].ipAddress must be a string when provided`);
  }
  if (asset.assetType !== undefined && !TARGET_ASSET_TYPES.includes(asset.assetType as TargetAssetType)) {
    errors.push(`reconAssets[${index}].assetType is invalid`);
  }
  if (asset.scopeStatus !== undefined && !SCOPE_STATUSES.includes(asset.scopeStatus as ScopeStatus)) {
    errors.push(`reconAssets[${index}].scopeStatus is invalid`);
  }
  if (asset.priority !== undefined && !PRIORITIES.includes(asset.priority as Priority)) {
    errors.push(`reconAssets[${index}].priority is invalid`);
  }
  if (!RECON_ASSET_STATUSES.includes(asset.status as ReconAssetStatus)) {
    errors.push(`reconAssets[${index}].status is invalid`);
  }
  if (!isBoolean(asset.inScope)) errors.push(`reconAssets[${index}].inScope must be a boolean`);
  if (asset.httpStatus !== undefined && (!isNumber(asset.httpStatus) || asset.httpStatus < 0)) {
    errors.push(`reconAssets[${index}].httpStatus must be a non-negative number when provided`);
  }
  if (asset.title !== undefined && !isString(asset.title)) {
    errors.push(`reconAssets[${index}].title must be a string when provided`);
  }
  if (!Array.isArray(asset.technologies)) {
    errors.push(`reconAssets[${index}].technologies must be an array`);
  }
  if (asset.ports !== undefined) {
    if (!Array.isArray(asset.ports)) {
      errors.push(`reconAssets[${index}].ports must be an array when provided`);
    } else {
      for (const port of asset.ports) {
        if (!isNumber(port) || port < 0 || port > 65535) {
          errors.push(`reconAssets[${index}].ports contains invalid port`);
        }
      }
    }
  }
  if (asset.notes !== undefined && !isString(asset.notes)) {
    errors.push(`reconAssets[${index}].notes must be a string when provided`);
  }
  if (asset.source !== undefined && !RECON_ASSET_SOURCES.includes(asset.source as ReconAssetSource)) {
    errors.push(`reconAssets[${index}].source is invalid`);
  }
  if (asset.tags !== undefined) {
    if (!Array.isArray(asset.tags)) {
      errors.push(`reconAssets[${index}].tags must be an array when provided`);
    } else {
      for (const tag of asset.tags) {
        if (!isString(tag) || !isValidTag(tag)) {
          errors.push(`reconAssets[${index}].tags contains invalid tag "${String(tag)}"`);
        }
      }
    }
  }
  if (!isNumber(asset.discoveredAt)) errors.push(`reconAssets[${index}].discoveredAt must be a number`);
  if (asset.lastTestedAt !== undefined && !isNumber(asset.lastTestedAt)) {
    errors.push(`reconAssets[${index}].lastTestedAt must be a number when provided`);
  }
  if (!isNumber(asset.createdAt)) errors.push(`reconAssets[${index}].createdAt must be a number`);
  if (!isNumber(asset.updatedAt)) errors.push(`reconAssets[${index}].updatedAt must be a number`);

  return asset as ReconAsset;
}

function validatePayloadEntity(value: unknown, index: number, errors: string[]): Payload | null {
  if (!isRecord(value)) {
    errors.push(`payloads[${index}] must be an object`);
    return null;
  }

  const pl = value as Partial<Payload>;

  if (!isString(pl.id) || !isValidUUID(pl.id)) errors.push(`payloads[${index}].id is invalid`);
  if (!isString(pl.name) || pl.name.trim().length === 0 || pl.name.length > 200) {
    errors.push(`payloads[${index}].name must be 1-200 characters`);
  }
  if (!PAYLOAD_CATEGORIES.includes(pl.category as PayloadCategory)) {
    errors.push(`payloads[${index}].category is invalid`);
  }
  if (!isString(pl.payload)) errors.push(`payloads[${index}].payload must be a string`);
  if (pl.description !== undefined && (!isString(pl.description) || pl.description.length > 2000)) {
    errors.push(`payloads[${index}].description must be <= 2000 characters when provided`);
  }
  if (!Array.isArray(pl.tags)) {
    errors.push(`payloads[${index}].tags must be an array`);
  } else {
    for (const tag of pl.tags) {
      if (!isString(tag) || !isValidTag(tag)) {
        errors.push(`payloads[${index}].tags contains invalid tag "${String(tag)}"`);
      }
    }
  }
  if (pl.language !== undefined && !isString(pl.language)) {
    errors.push(`payloads[${index}].language must be a string when provided`);
  }
  if (pl.context !== undefined && !isString(pl.context)) {
    errors.push(`payloads[${index}].context must be a string when provided`);
  }
  if (pl.source !== undefined && !isString(pl.source)) {
    errors.push(`payloads[${index}].source must be a string when provided`);
  }
  if (!isBoolean(pl.isBuiltIn)) errors.push(`payloads[${index}].isBuiltIn must be a boolean`);
  if (!isBoolean(pl.isFavorite)) errors.push(`payloads[${index}].isFavorite must be a boolean`);
  if (!isNumber(pl.useCount) || pl.useCount < 0) {
    errors.push(`payloads[${index}].useCount must be a non-negative number`);
  }
  if (pl.lastUsedAt !== undefined && !isNumber(pl.lastUsedAt)) {
    errors.push(`payloads[${index}].lastUsedAt must be a number when provided`);
  }
  if (!isNumber(pl.createdAt)) errors.push(`payloads[${index}].createdAt must be a number`);
  if (!isNumber(pl.updatedAt)) errors.push(`payloads[${index}].updatedAt must be a number`);

  return pl as Payload;
}

function validateChecklistTemplateItem(value: unknown, sectionIndex: number, itemIndex: number, errors: string[]): ChecklistTemplateItem | null {
  if (!isRecord(value)) {
    errors.push(`checklistTemplates[${sectionIndex}].items[${itemIndex}] must be an object`);
    return null;
  }

  const item = value as Partial<ChecklistTemplateItem>;

  if (!isString(item.id)) errors.push(`checklistTemplates[${sectionIndex}].items[${itemIndex}].id must be a string`);
  if (!isString(item.title) || item.title.trim().length === 0) {
    errors.push(`checklistTemplates[${sectionIndex}].items[${itemIndex}].title must be a non-empty string`);
  }
  if (item.description !== undefined && !isString(item.description)) {
    errors.push(`checklistTemplates[${sectionIndex}].items[${itemIndex}].description must be a string when provided`);
  }
  if (item.references !== undefined) {
    if (!Array.isArray(item.references)) {
      errors.push(`checklistTemplates[${sectionIndex}].items[${itemIndex}].references must be an array when provided`);
    }
  }
  if (item.severityHint !== undefined && !PAYOUT_SEVERITIES.includes(item.severityHint as PayoutSeverity)) {
    errors.push(`checklistTemplates[${sectionIndex}].items[${itemIndex}].severityHint is invalid`);
  }

  return item as ChecklistTemplateItem;
}

function validateChecklistTemplateSection(value: unknown, templateIndex: number, sectionIndex: number, errors: string[]): ChecklistTemplateSection | null {
  if (!isRecord(value)) {
    errors.push(`checklistTemplates[${templateIndex}].sections[${sectionIndex}] must be an object`);
    return null;
  }

  const section = value as Partial<ChecklistTemplateSection>;

  if (!isString(section.id)) errors.push(`checklistTemplates[${templateIndex}].sections[${sectionIndex}].id must be a string`);
  if (!isString(section.title) || section.title.trim().length === 0) {
    errors.push(`checklistTemplates[${templateIndex}].sections[${sectionIndex}].title must be a non-empty string`);
  }
  if (!Array.isArray(section.items)) {
    errors.push(`checklistTemplates[${templateIndex}].sections[${sectionIndex}].items must be an array`);
    return null;
  }

  const items = section.items
    .map((item, i) => validateChecklistTemplateItem(item, templateIndex, i, errors))
    .filter((item): item is ChecklistTemplateItem => Boolean(item));

  return { ...section, items } as ChecklistTemplateSection;
}

function validateChecklistTemplate(value: unknown, index: number, errors: string[]): ChecklistTemplate | null {
  if (!isRecord(value)) {
    errors.push(`checklistTemplates[${index}] must be an object`);
    return null;
  }

  const tpl = value as Partial<ChecklistTemplate>;

  if (!isString(tpl.id) || !isValidUUID(tpl.id)) errors.push(`checklistTemplates[${index}].id is invalid`);
  if (!isString(tpl.name) || tpl.name.trim().length === 0 || tpl.name.length > 200) {
    errors.push(`checklistTemplates[${index}].name must be 1-200 characters`);
  }
  if (!CHECKLIST_KINDS.includes(tpl.kind as ChecklistKind)) {
    errors.push(`checklistTemplates[${index}].kind is invalid`);
  }
  if (tpl.description !== undefined && (!isString(tpl.description) || tpl.description.length > 2000)) {
    errors.push(`checklistTemplates[${index}].description must be <= 2000 characters when provided`);
  }
  if (!Array.isArray(tpl.sections)) {
    errors.push(`checklistTemplates[${index}].sections must be an array`);
  } else {
    const validSections = tpl.sections
      .map((section, i) => validateChecklistTemplateSection(section, index, i, errors))
      .filter((section): section is ChecklistTemplateSection => Boolean(section));
    return { ...tpl, sections: validSections } as ChecklistTemplate;
  }
  if (!isBoolean(tpl.isBuiltIn)) errors.push(`checklistTemplates[${index}].isBuiltIn must be a boolean`);
  if (tpl.source !== undefined && !isString(tpl.source)) {
    errors.push(`checklistTemplates[${index}].source must be a string when provided`);
  }
  if (!isNumber(tpl.createdAt)) errors.push(`checklistTemplates[${index}].createdAt must be a number`);
  if (!isNumber(tpl.updatedAt)) errors.push(`checklistTemplates[${index}].updatedAt must be a number`);

  return tpl as ChecklistTemplate;
}

function validateChecklistInstance(
  value: unknown,
  index: number,
  targetIds: Set<string>,
  errors: string[]
): ChecklistInstance | null {
  if (!isRecord(value)) {
    errors.push(`checklistInstances[${index}] must be an object`);
    return null;
  }

  const inst = value as Partial<ChecklistInstance>;

  if (!isString(inst.id) || !isValidUUID(inst.id)) errors.push(`checklistInstances[${index}].id is invalid`);
  if (!isString(inst.templateId) || inst.templateId.trim().length === 0) {
    errors.push(`checklistInstances[${index}].templateId must be a non-empty string`);
  }
  if (!isString(inst.targetId) || !targetIds.has(inst.targetId)) {
    errors.push(`checklistInstances[${index}].targetId must reference an imported or existing target`);
  }
  if (!isString(inst.templateName) || inst.templateName.trim().length === 0) {
    errors.push(`checklistInstances[${index}].templateName must be a non-empty string`);
  }
  if (!CHECKLIST_KINDS.includes(inst.templateKind as ChecklistKind)) {
    errors.push(`checklistInstances[${index}].templateKind is invalid`);
  }
  if (!isRecord(inst.itemStates)) {
    errors.push(`checklistInstances[${index}].itemStates must be an object`);
  } else {
    for (const [key, state] of Object.entries(inst.itemStates)) {
      if (!isRecord(state)) {
        errors.push(`checklistInstances[${index}].itemStates.${key} must be an object`);
        continue;
      }
      const itemState = state as Partial<ChecklistInstanceItemState>;
      if (!CHECKLIST_ITEM_STATUSES.includes(itemState.status as ChecklistItemStatus)) {
        errors.push(`checklistInstances[${index}].itemStates.${key}.status is invalid`);
      }
      if (itemState.notes !== undefined && !isString(itemState.notes)) {
        errors.push(`checklistInstances[${index}].itemStates.${key}.notes must be a string when provided`);
      }
      if (itemState.evidenceAssetId !== undefined && !isString(itemState.evidenceAssetId)) {
        errors.push(`checklistInstances[${index}].itemStates.${key}.evidenceAssetId must be a string when provided`);
      }
      if (itemState.noteId !== undefined && !isString(itemState.noteId)) {
        errors.push(`checklistInstances[${index}].itemStates.${key}.noteId must be a string when provided`);
      }
      if (itemState.severity !== undefined && !PAYOUT_SEVERITIES.includes(itemState.severity as PayoutSeverity)) {
        errors.push(`checklistInstances[${index}].itemStates.${key}.severity is invalid`);
      }
      if (!isNumber(itemState.updatedAt)) {
        errors.push(`checklistInstances[${index}].itemStates.${key}.updatedAt must be a number`);
      }
    }
  }
  if (inst.notes !== undefined && !isString(inst.notes)) {
    errors.push(`checklistInstances[${index}].notes must be a string when provided`);
  }
  if (inst.startedAt !== undefined && !isNumber(inst.startedAt)) {
    errors.push(`checklistInstances[${index}].startedAt must be a number when provided`);
  }
  if (inst.completedAt !== undefined && !isNumber(inst.completedAt)) {
    errors.push(`checklistInstances[${index}].completedAt must be a number when provided`);
  }
  if (!isNumber(inst.createdAt)) errors.push(`checklistInstances[${index}].createdAt must be a number`);
  if (!isNumber(inst.updatedAt)) errors.push(`checklistInstances[${index}].updatedAt must be a number`);

  return inst as ChecklistInstance;
}

function validateSubmission(
  value: unknown,
  index: number,
  targetIds: Set<string>,
  noteIds: Set<string>,
  payoutIds: Set<string>,
  errors: string[]
): Submission | null {
  if (!isRecord(value)) {
    errors.push(`submissions[${index}] must be an object`);
    return null;
  }

  const sub = value as Partial<Submission>;

  if (!isString(sub.id) || !isValidUUID(sub.id)) errors.push(`submissions[${index}].id is invalid`);
  if (!isString(sub.title) || sub.title.trim().length === 0 || sub.title.length > 200) {
    errors.push(`submissions[${index}].title must be 1-200 characters`);
  }
  if (!isString(sub.targetId) || !targetIds.has(sub.targetId)) {
    errors.push(`submissions[${index}].targetId must reference an imported or existing target`);
  }
  if (sub.noteId !== undefined && (!isString(sub.noteId) || !noteIds.has(sub.noteId))) {
    errors.push(`submissions[${index}].noteId must reference an imported or existing note`);
  }
  if (!PLATFORMS.includes(sub.platform as Platform)) {
    errors.push(`submissions[${index}].platform is invalid`);
  }
  if (sub.vulnerabilityType !== undefined && !isString(sub.vulnerabilityType)) {
    errors.push(`submissions[${index}].vulnerabilityType must be a string when provided`);
  }
  if (!PAYOUT_SEVERITIES.includes(sub.severity as PayoutSeverity)) {
    errors.push(`submissions[${index}].severity is invalid`);
  }
  if (sub.cvssScore !== undefined && (!isNumber(sub.cvssScore) || sub.cvssScore < 0 || sub.cvssScore > 10)) {
    errors.push(`submissions[${index}].cvssScore must be between 0 and 10 when provided`);
  }
  if (sub.cvssVector !== undefined && !isString(sub.cvssVector)) {
    errors.push(`submissions[${index}].cvssVector must be a string when provided`);
  }
  if (sub.reportUrl !== undefined && (!isString(sub.reportUrl) || !isValidURL(sub.reportUrl))) {
    errors.push(`submissions[${index}].reportUrl must be valid when provided`);
  }
  if (sub.reportMarkdown !== undefined && !isString(sub.reportMarkdown)) {
    errors.push(`submissions[${index}].reportMarkdown must be a string when provided`);
  }
  if (!SUBMISSION_STATUSES.includes(sub.status as SubmissionStatus)) {
    errors.push(`submissions[${index}].status is invalid`);
  }
  if (sub.submittedAt !== undefined && !isNumber(sub.submittedAt)) {
    errors.push(`submissions[${index}].submittedAt must be a number when provided`);
  }
  if (sub.triagedAt !== undefined && !isNumber(sub.triagedAt)) {
    errors.push(`submissions[${index}].triagedAt must be a number when provided`);
  }
  if (sub.resolvedAt !== undefined && !isNumber(sub.resolvedAt)) {
    errors.push(`submissions[${index}].resolvedAt must be a number when provided`);
  }
  if (sub.rewardedAt !== undefined && !isNumber(sub.rewardedAt)) {
    errors.push(`submissions[${index}].rewardedAt must be a number when provided`);
  }
  if (sub.bountyAmount !== undefined && (!isNumber(sub.bountyAmount) || sub.bountyAmount < 0)) {
    errors.push(`submissions[${index}].bountyAmount must be a non-negative number when provided`);
  }
  if (!Array.isArray(sub.payoutIds)) {
    errors.push(`submissions[${index}].payoutIds must be an array`);
  } else {
    for (const pid of sub.payoutIds) {
      if (!isString(pid) || !payoutIds.has(pid)) {
        errors.push(`submissions[${index}].payoutIds contains invalid payout reference "${String(pid)}"`);
      }
    }
  }
  if (sub.duplicateOf !== undefined && !isString(sub.duplicateOf)) {
    errors.push(`submissions[${index}].duplicateOf must be a string when provided`);
  }
  if (sub.notes !== undefined && !isString(sub.notes)) {
    errors.push(`submissions[${index}].notes must be a string when provided`);
  }
  if (!Array.isArray(sub.tags)) {
    errors.push(`submissions[${index}].tags must be an array`);
  } else {
    for (const tag of sub.tags) {
      if (!isString(tag) || !isValidTag(tag)) {
        errors.push(`submissions[${index}].tags contains invalid tag "${String(tag)}"`);
      }
    }
  }
  if (!Array.isArray(sub.timeline)) {
    errors.push(`submissions[${index}].timeline must be an array`);
  } else {
    for (let i = 0; i < sub.timeline.length; i++) {
      const entry = sub.timeline[i] as Partial<SubmissionTimelineEntry>;
      if (!isRecord(entry)) {
        errors.push(`submissions[${index}].timeline[${i}] must be an object`);
        continue;
      }
      if (!isString(entry.id)) errors.push(`submissions[${index}].timeline[${i}].id must be a string`);
      if (!SUBMISSION_STATUSES.includes(entry.status as SubmissionStatus)) {
        errors.push(`submissions[${index}].timeline[${i}].status is invalid`);
      }
      if (!isNumber(entry.at)) errors.push(`submissions[${index}].timeline[${i}].at must be a number`);
      if (entry.note !== undefined && !isString(entry.note)) {
        errors.push(`submissions[${index}].timeline[${i}].note must be a string when provided`);
      }
    }
  }
  if (!isNumber(sub.createdAt)) errors.push(`submissions[${index}].createdAt must be a number`);
  if (!isNumber(sub.updatedAt)) errors.push(`submissions[${index}].updatedAt must be a number`);

  return sub as Submission;
}

function validateBookmark(value: unknown, index: number, errors: string[]): Bookmark | null {
  if (!isRecord(value)) {
    errors.push(`bookmarks[${index}] must be an object`);
    return null;
  }

  const bm = value as Partial<Bookmark>;

  if (!isString(bm.id) || !isValidUUID(bm.id)) errors.push(`bookmarks[${index}].id is invalid`);
  if (!isString(bm.title) || bm.title.trim().length === 0 || bm.title.length > 200) {
    errors.push(`bookmarks[${index}].title must be 1-200 characters`);
  }
  if (!isString(bm.url) || !isValidURL(bm.url)) {
    errors.push(`bookmarks[${index}].url must be a valid URL`);
  }
  if (!BOOKMARK_CATEGORIES.includes(bm.category as BookmarkCategory)) {
    errors.push(`bookmarks[${index}].category is invalid`);
  }
  if (bm.vulnClass !== undefined && !PAYLOAD_CATEGORIES.includes(bm.vulnClass as PayloadCategory)) {
    errors.push(`bookmarks[${index}].vulnClass is invalid`);
  }
  if (bm.description !== undefined && (!isString(bm.description) || bm.description.length > 2000)) {
    errors.push(`bookmarks[${index}].description must be <= 2000 characters when provided`);
  }
  if (!Array.isArray(bm.tags)) {
    errors.push(`bookmarks[${index}].tags must be an array`);
  } else {
    for (const tag of bm.tags) {
      if (!isString(tag) || !isValidTag(tag)) {
        errors.push(`bookmarks[${index}].tags contains invalid tag "${String(tag)}"`);
      }
    }
  }
  if (!isBoolean(bm.isBuiltIn)) errors.push(`bookmarks[${index}].isBuiltIn must be a boolean`);
  if (!isBoolean(bm.isFavorite)) errors.push(`bookmarks[${index}].isFavorite must be a boolean`);
  if (!isNumber(bm.createdAt)) errors.push(`bookmarks[${index}].createdAt must be a number`);
  if (!isNumber(bm.updatedAt)) errors.push(`bookmarks[${index}].updatedAt must be a number`);

  return bm as Bookmark;
}

export async function validateImportData(payload: unknown): Promise<HuntFlowExport> {
  const parsed = parsePayload(payload);
  const errors: string[] = [];

  if (!isRecord(parsed)) {
    throw new ImportValidationError(['Import payload must be an object']);
  }

  const meta = isRecord(parsed.meta) ? parsed.meta : null;
  const data = isRecord(parsed.data) ? parsed.data : null;

  if (!meta) errors.push('meta must be an object');
  if (meta && meta.version !== '1.0') errors.push('meta.version must be "1.0"');
  if (meta && !isNumber(meta.exportedAt)) errors.push('meta.exportedAt must be a number');
  if (meta && !isString(meta.appVersion)) errors.push('meta.appVersion must be a string');
  if (!data) errors.push('data must be an object');

  if (!data) throw new ImportValidationError(errors);

  const rawTargets = Array.isArray(data.targets) ? data.targets : [];
  const rawSessions = Array.isArray(data.sessions) ? data.sessions : [];
  const rawNotes = Array.isArray(data.notes) ? data.notes : [];
  const rawPayouts = Array.isArray(data.payouts) ? data.payouts : [];
  const rawEvidenceAssets = Array.isArray(data.evidenceAssets) ? data.evidenceAssets : [];
  const rawEvidenceLinks = Array.isArray(data.evidenceLinks) ? data.evidenceLinks : [];
  const rawEvidenceCanvasViews = Array.isArray(data.evidenceCanvasViews) ? data.evidenceCanvasViews : [];
  const rawReconAssets = Array.isArray(data.reconAssets) ? data.reconAssets : [];
  const rawPayloads = Array.isArray(data.payloads) ? data.payloads : [];
  const rawChecklistTemplates = Array.isArray(data.checklistTemplates) ? data.checklistTemplates : [];
  const rawChecklistInstances = Array.isArray(data.checklistInstances) ? data.checklistInstances : [];
  const rawSubmissions = Array.isArray(data.submissions) ? data.submissions : [];
  const rawBookmarks = Array.isArray(data.bookmarks) ? data.bookmarks : [];

  if (!Array.isArray(data.targets)) errors.push('data.targets must be an array');
  if (!Array.isArray(data.sessions)) errors.push('data.sessions must be an array');
  if (!Array.isArray(data.notes)) errors.push('data.notes must be an array');
  if (data.payouts !== undefined && !Array.isArray(data.payouts)) {
    errors.push('data.payouts must be an array when provided');
  }
  if (data.evidenceAssets !== undefined && !Array.isArray(data.evidenceAssets)) {
    errors.push('data.evidenceAssets must be an array when provided');
  }
  if (data.evidenceLinks !== undefined && !Array.isArray(data.evidenceLinks)) {
    errors.push('data.evidenceLinks must be an array when provided');
  }
  if (data.evidenceCanvasViews !== undefined && !Array.isArray(data.evidenceCanvasViews)) {
    errors.push('data.evidenceCanvasViews must be an array when provided');
  }
  if (data.reconAssets !== undefined && !Array.isArray(data.reconAssets)) {
    errors.push('data.reconAssets must be an array when provided');
  }
  if (data.payloads !== undefined && !Array.isArray(data.payloads)) {
    errors.push('data.payloads must be an array when provided');
  }
  if (data.checklistTemplates !== undefined && !Array.isArray(data.checklistTemplates)) {
    errors.push('data.checklistTemplates must be an array when provided');
  }
  if (data.checklistInstances !== undefined && !Array.isArray(data.checklistInstances)) {
    errors.push('data.checklistInstances must be an array when provided');
  }
  if (data.submissions !== undefined && !Array.isArray(data.submissions)) {
    errors.push('data.submissions must be an array when provided');
  }
  if (data.bookmarks !== undefined && !Array.isArray(data.bookmarks)) {
    errors.push('data.bookmarks must be an array when provided');
  }

  const existingTargets = await targetDB.getAll();
  const existingSessions = await sessionDB.getAll();
  const existingNotes = await noteDB.getAll();
  const existingAssets = await evidenceAssetDB.getAll();
  const existingPayouts = await payoutDB.getAll();
  const targetIds = new Set(existingTargets.map((target) => target.id));
  const sessionIds = new Set(existingSessions.map((session) => session.id));
  const noteIds = new Set(existingNotes.map((note) => note.id));
  const assetIds = new Set(existingAssets.map((asset) => asset.id));
  const payoutIds = new Set(existingPayouts.map((payout) => payout.id));

  const targets = rawTargets
    .map((target, index) => validateTarget(target, index, errors))
    .filter((target): target is Target => Boolean(target));

  for (const target of targets) targetIds.add(target.id);

  const sessions = rawSessions
    .map((session, index) => validateSession(session, index, targetIds, errors))
    .filter((session): session is Session => Boolean(session));

  for (const session of sessions) sessionIds.add(session.id);

  const notes = rawNotes
    .map((note, index) => validateNote(note, index, targetIds, sessionIds, errors))
    .filter((note): note is Note => Boolean(note));

  for (const note of notes) noteIds.add(note.id);

  const payouts = rawPayouts
    .map((payout, index) => validatePayout(payout, index, errors))
    .filter((payout): payout is Payout => Boolean(payout));

  for (const payout of payouts) payoutIds.add(payout.id);

  const evidenceAssets = rawEvidenceAssets
    .map((asset, index) => validateEvidenceAsset(asset, index, targetIds, sessionIds, noteIds, errors))
    .filter((asset): asset is EvidenceAsset => Boolean(asset));

  for (const asset of evidenceAssets) assetIds.add(asset.id);

  const evidenceLinks = rawEvidenceLinks
    .map((link, index) =>
      validateEvidenceLink(link, index, { targetIds, sessionIds, noteIds, assetIds }, errors)
    )
    .filter((link): link is EvidenceLink => Boolean(link));

  const evidenceCanvasViews = rawEvidenceCanvasViews
    .map((view, index) => validateEvidenceCanvasView(view, index, targetIds, errors))
    .filter((view): view is EvidenceCanvasView => Boolean(view));

  const reconAssets = rawReconAssets
    .map((asset, index) => validateReconAsset(asset, index, targetIds, errors))
    .filter((asset): asset is ReconAsset => Boolean(asset));

  const payloads = rawPayloads
    .map((pl, index) => validatePayloadEntity(pl, index, errors))
    .filter((pl): pl is Payload => Boolean(pl));

  const checklistTemplates = rawChecklistTemplates
    .map((tpl, index) => validateChecklistTemplate(tpl, index, errors))
    .filter((tpl): tpl is ChecklistTemplate => Boolean(tpl));

  const checklistInstances = rawChecklistInstances
    .map((inst, index) => validateChecklistInstance(inst, index, targetIds, errors))
    .filter((inst): inst is ChecklistInstance => Boolean(inst));

  const submissions = rawSubmissions
    .map((sub, index) => validateSubmission(sub, index, targetIds, noteIds, payoutIds, errors))
    .filter((sub): sub is Submission => Boolean(sub));

  const bookmarks = rawBookmarks
    .map((bm, index) => validateBookmark(bm, index, errors))
    .filter((bm): bm is Bookmark => Boolean(bm));

  const settings = validateSettings(data.settings, errors);

  if (errors.length > 0) throw new ImportValidationError(errors);

  return {
    meta: meta as HuntFlowExport['meta'],
    data: {
      sessions,
      notes,
      targets,
      payouts,
      evidenceAssets,
      evidenceLinks,
      evidenceCanvasViews,
      reconAssets,
      payloads,
      checklistTemplates,
      checklistInstances,
      submissions,
      bookmarks,
      settings
    }
  };
}

export async function importData(payload: unknown): Promise<HuntFlowExport> {
  const validated = await validateImportData(payload);

  await Promise.all([
    targetDB.putBatch(validated.data.targets),
    sessionDB.putBatch(validated.data.sessions),
    noteDB.putBatch(validated.data.notes),
    payoutDB.putBatch(validated.data.payouts),
    evidenceAssetDB.putBatch(validated.data.evidenceAssets ?? []),
    evidenceLinkDB.putBatch(validated.data.evidenceLinks ?? []),
    evidenceCanvasViewDB.putBatch(validated.data.evidenceCanvasViews ?? []),
    reconAssetDB.putBatch(validated.data.reconAssets ?? []),
    payloadDB.putBatch(validated.data.payloads ?? []),
    checklistTemplateDB.putBatch(validated.data.checklistTemplates ?? []),
    checklistInstanceDB.putBatch(validated.data.checklistInstances ?? []),
    submissionDB.putBatch(validated.data.submissions ?? []),
    bookmarkDB.putBatch(validated.data.bookmarks ?? []),
    settingsDB.putSettings(validated.data.settings)
  ]);

  return validated;
}
