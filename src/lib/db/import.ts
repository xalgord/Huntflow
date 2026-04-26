import { evidenceAssetDB, evidenceCanvasViewDB, evidenceLinkDB } from './evidence';
import { noteDB } from './notes';
import { payoutDB } from './payouts';
import { sessionDB } from './sessions';
import { settingsDB } from './settings';
import { targetDB } from './targets';
import {
  DEFAULT_SETTINGS,
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
  type Payout,
  type PayoutSeverity,
  type PayoutStatus,
  type Platform,
  type Priority,
  type Session,
  type SessionTag,
  type Settings,
  type Target,
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
const EVIDENCE_KINDS: EvidenceAssetKind[] = ['image', 'pdf', 'text', 'request', 'response', 'archive', 'binary', 'url'];
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

  const existingTargets = await targetDB.getAll();
  const existingSessions = await sessionDB.getAll();
  const existingNotes = await noteDB.getAll();
  const existingAssets = await evidenceAssetDB.getAll();
  const targetIds = new Set(existingTargets.map((target) => target.id));
  const sessionIds = new Set(existingSessions.map((session) => session.id));
  const noteIds = new Set(existingNotes.map((note) => note.id));
  const assetIds = new Set(existingAssets.map((asset) => asset.id));

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
    settingsDB.putSettings(validated.data.settings)
  ]);

  return validated;
}
