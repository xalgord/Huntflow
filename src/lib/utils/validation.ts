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
  type NoteTemplate,
  type Platform,
  type Priority,
  type Session,
  type SessionTag,
  type Settings,
  type Target,
  type TargetStatus,
  type TemplateCategory
} from '$lib/types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ReferenceOptions {
  targetIds?: Iterable<string>;
  sessionIds?: Iterable<string>;
  noteIds?: Iterable<string>;
  assetIds?: Iterable<string>;
  now?: number;
}

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
const TEMPLATE_CATEGORIES: TemplateCategory[] = ['web', 'mobile', 'api', 'cloud', 'network', 'general'];
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

function result(errors: string[]): ValidationResult {
  return { valid: errors.length === 0, errors };
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

function referenceSet(values?: Iterable<string>): Set<string> | undefined {
  return values ? new Set(values) : undefined;
}

export function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function isValidURL(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function isValidSessionTag(value: unknown): value is SessionTag {
  return SESSION_TAGS.includes(value as SessionTag);
}

export function isValidPlatform(value: unknown): value is Platform {
  return PLATFORMS.includes(value as Platform);
}

export function isValidPriority(value: unknown): value is Priority {
  return PRIORITIES.includes(value as Priority);
}

export function isValidTargetStatus(value: unknown): value is TargetStatus {
  return TARGET_STATUSES.includes(value as TargetStatus);
}

export function isValidTemplateCategory(value: unknown): value is TemplateCategory {
  return TEMPLATE_CATEGORIES.includes(value as TemplateCategory);
}

export function isValidNoteTag(value: string): boolean {
  return /^[a-z0-9_-]{1,30}$/i.test(value);
}

export function validateTarget(value: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) return result(['target must be an object']);

  const target = value as Partial<Target>;

  if (!isString(target.id) || !isValidUUID(target.id)) errors.push('target.id must be a UUID v4');
  if (!isString(target.name) || target.name.trim().length === 0 || target.name.length > 100) {
    errors.push('target.name must be 1-100 characters');
  }
  if (!isValidPlatform(target.platform)) errors.push('target.platform is invalid');
  if (target.programUrl !== undefined && (!isString(target.programUrl) || !isValidURL(target.programUrl))) {
    errors.push('target.programUrl must be a valid URL when provided');
  }
  if (!isString(target.scope) || target.scope.length > 5_000) {
    errors.push('target.scope must be a string up to 5000 characters');
  }
  if (!isString(target.notes) || target.notes.length > 10_000) {
    errors.push('target.notes must be a string up to 10000 characters');
  }
  if (!isValidPriority(target.priority)) errors.push('target.priority is invalid');
  if (!isValidTargetStatus(target.status)) errors.push('target.status is invalid');
  if (!isNumber(target.createdAt)) errors.push('target.createdAt must be a timestamp');
  if (!isNumber(target.updatedAt)) errors.push('target.updatedAt must be a timestamp');
  if (target.lastSessionAt !== undefined && !isNumber(target.lastSessionAt)) {
    errors.push('target.lastSessionAt must be a timestamp when provided');
  }
  if (!isNumber(target.sessionCount) || target.sessionCount < 0) {
    errors.push('target.sessionCount must be a non-negative number');
  }

  return result(errors);
}

export function validateSession(value: unknown, options: ReferenceOptions = {}): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) return result(['session must be an object']);

  const session = value as Partial<Session>;
  const targetIds = referenceSet(options.targetIds);
  const now = options.now ?? Date.now();

  if (!isString(session.id) || !isValidUUID(session.id)) errors.push('session.id must be a UUID v4');
  if (!isString(session.targetId) || (targetIds && !targetIds.has(session.targetId))) {
    errors.push('session.targetId must reference an existing target');
  }
  if (session.templateId !== undefined && !isString(session.templateId)) {
    errors.push('session.templateId must be a string when provided');
  }
  if (!isNumber(session.durationPlanned) || session.durationPlanned <= 0 || session.durationPlanned > 14_400) {
    errors.push('session.durationPlanned must be between 1 and 14400 seconds');
  }
  if (
    !isNumber(session.durationActual) ||
    session.durationActual < 0 ||
    (isNumber(session.durationPlanned) && session.durationActual > session.durationPlanned)
  ) {
    errors.push('session.durationActual must be between 0 and durationPlanned');
  }
  if (!isNumber(session.startedAt) || session.startedAt > now) {
    errors.push('session.startedAt must be a timestamp not in the future');
  }
  if (session.endedAt !== undefined) {
    if (!isNumber(session.endedAt) || (isNumber(session.startedAt) && session.endedAt < session.startedAt)) {
      errors.push('session.endedAt must be greater than or equal to startedAt');
    }
  }
  if (!SESSION_STATUSES.includes(session.status as Session['status'])) errors.push('session.status is invalid');
  if (
    session.status === 'abandoned' &&
    isNumber(session.durationActual) &&
    isNumber(session.durationPlanned) &&
    session.durationActual >= session.durationPlanned * 0.5
  ) {
    errors.push('session.status can be abandoned only before 50% completion');
  }
  if (session.quickNote !== undefined && !isString(session.quickNote)) {
    errors.push('session.quickNote must be a string when provided');
  }
  if (!Array.isArray(session.tags) || session.tags.length > 5) {
    errors.push('session.tags must contain at most 5 tags');
  } else {
    for (const tag of session.tags) {
      if (!isValidSessionTag(tag)) errors.push(`session.tags contains invalid tag "${String(tag)}"`);
    }
  }

  return result(errors);
}

export function validateNote(value: unknown, options: ReferenceOptions = {}): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) return result(['note must be an object']);

  const note = value as Partial<Note>;
  const targetIds = referenceSet(options.targetIds);
  const sessionIds = referenceSet(options.sessionIds);

  if (!isString(note.id) || !isValidUUID(note.id)) errors.push('note.id must be a UUID v4');
  if (!isString(note.title) || note.title.trim().length === 0 || note.title.length > 200) {
    errors.push('note.title must be 1-200 characters');
  }
  if (!isString(note.content) || note.content.length > 50_000) {
    errors.push('note.content must be a string up to 50000 characters');
  }
  if (!isString(note.targetId) || (targetIds && !targetIds.has(note.targetId))) {
    errors.push('note.targetId must reference an existing target');
  }
  if (note.sessionId !== undefined && (!isString(note.sessionId) || (sessionIds && !sessionIds.has(note.sessionId)))) {
    errors.push('note.sessionId must reference an existing session when provided');
  }
  if (note.templateId !== undefined && !isString(note.templateId)) {
    errors.push('note.templateId must be a string when provided');
  }
  if (!Array.isArray(note.tags) || note.tags.length > 10) {
    errors.push('note.tags must contain at most 10 tags');
  } else {
    for (const tag of note.tags) {
      if (!isString(tag) || !isValidNoteTag(tag)) {
        errors.push(`note.tags contains invalid tag "${String(tag)}"`);
      }
    }
  }
  if (!isNumber(note.createdAt)) errors.push('note.createdAt must be a timestamp');
  if (!isNumber(note.updatedAt)) errors.push('note.updatedAt must be a timestamp');

  return result(errors);
}

export function validateEvidenceAsset(value: unknown, options: ReferenceOptions = {}): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) return result(['evidence asset must be an object']);

  const asset = value as Partial<EvidenceAsset>;
  const targetIds = referenceSet(options.targetIds);
  const sessionIds = referenceSet(options.sessionIds);
  const noteIds = referenceSet(options.noteIds);

  if (!isString(asset.id) || !isValidUUID(asset.id)) errors.push('asset.id must be a UUID v4');
  if (!isString(asset.title) || asset.title.trim().length === 0 || asset.title.length > 160) {
    errors.push('asset.title must be 1-160 characters');
  }
  if (!EVIDENCE_KINDS.includes(asset.kind as EvidenceAssetKind)) errors.push('asset.kind is invalid');
  if (!EVIDENCE_SOURCES.includes(asset.source as EvidenceAssetSource)) errors.push('asset.source is invalid');
  if (!isString(asset.mimeType) || asset.mimeType.length > 120) {
    errors.push('asset.mimeType must be a string up to 120 characters');
  }
  if (!isNumber(asset.size) || asset.size < 0) {
    errors.push('asset.size must be a non-negative number');
  }
  if (asset.fileName !== undefined && (!isString(asset.fileName) || asset.fileName.length > 220)) {
    errors.push('asset.fileName must be up to 220 characters when provided');
  }
  if (asset.relativePath !== undefined && (!isString(asset.relativePath) || asset.relativePath.length > 1000)) {
    errors.push('asset.relativePath must be up to 1000 characters when provided');
  }
  if (asset.folderPath !== undefined && (!isString(asset.folderPath) || asset.folderPath.length > 900)) {
    errors.push('asset.folderPath must be up to 900 characters when provided');
  }
  if (asset.description !== undefined && (!isString(asset.description) || asset.description.length > 2000)) {
    errors.push('asset.description must be up to 2000 characters when provided');
  }
  if (asset.url !== undefined && (!isString(asset.url) || !isValidURL(asset.url))) {
    errors.push('asset.url must be valid when provided');
  }
  if (asset.source === 'url' && !asset.url) errors.push('asset.url is required for URL assets');
  if (asset.textContent !== undefined && (!isString(asset.textContent) || asset.textContent.length > 100000)) {
    errors.push('asset.textContent must be up to 100000 characters when provided');
  }
  if (asset.storageId !== undefined && !isString(asset.storageId)) {
    errors.push('asset.storageId must be a string when provided');
  }
  if (asset.localBlobId !== undefined && !isString(asset.localBlobId)) {
    errors.push('asset.localBlobId must be a string when provided');
  }
  if (asset.targetId !== undefined && (!isString(asset.targetId) || (targetIds && !targetIds.has(asset.targetId)))) {
    errors.push('asset.targetId must reference an existing target');
  }
  if (
    asset.sessionId !== undefined &&
    (!isString(asset.sessionId) || (sessionIds && !sessionIds.has(asset.sessionId)))
  ) {
    errors.push('asset.sessionId must reference an existing session');
  }
  if (asset.noteId !== undefined && (!isString(asset.noteId) || (noteIds && !noteIds.has(asset.noteId)))) {
    errors.push('asset.noteId must reference an existing note');
  }
  if (!Array.isArray(asset.tags) || asset.tags.length > 12) {
    errors.push('asset.tags must contain at most 12 tags');
  } else {
    for (const tag of asset.tags) {
      if (!isString(tag) || !isValidNoteTag(tag)) {
        errors.push(`asset.tags contains invalid tag "${String(tag)}"`);
      }
    }
  }
  if (!EVIDENCE_SYNC_STATES.includes(asset.syncState as EvidenceSyncState)) {
    errors.push('asset.syncState is invalid');
  }
  if (asset.syncError !== undefined && (!isString(asset.syncError) || asset.syncError.length > 500)) {
    errors.push('asset.syncError must be up to 500 characters when provided');
  }
  if (!isNumber(asset.capturedAt)) errors.push('asset.capturedAt must be a timestamp');
  if (!isNumber(asset.createdAt)) errors.push('asset.createdAt must be a timestamp');
  if (!isNumber(asset.updatedAt)) errors.push('asset.updatedAt must be a timestamp');

  return result(errors);
}

function evidenceNodeReferenceIsValid(type: EvidenceNodeType, id: string, options: ReferenceOptions): boolean {
  if (type === 'target') return referenceSet(options.targetIds)?.has(id) ?? true;
  if (type === 'session') return referenceSet(options.sessionIds)?.has(id) ?? true;
  if (type === 'note') return referenceSet(options.noteIds)?.has(id) ?? true;
  return referenceSet(options.assetIds)?.has(id) ?? true;
}

export function validateEvidenceLink(value: unknown, options: ReferenceOptions = {}): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) return result(['evidence link must be an object']);

  const link = value as Partial<EvidenceLink>;

  if (!isString(link.id) || !isValidUUID(link.id)) errors.push('link.id must be a UUID v4');
  if (!EVIDENCE_NODE_TYPES.includes(link.fromType as EvidenceNodeType)) errors.push('link.fromType is invalid');
  if (!isString(link.fromId) || !evidenceNodeReferenceIsValid(link.fromType as EvidenceNodeType, link.fromId, options)) {
    errors.push('link.fromId must reference an existing node');
  }
  if (!EVIDENCE_NODE_TYPES.includes(link.toType as EvidenceNodeType)) errors.push('link.toType is invalid');
  if (!isString(link.toId) || !evidenceNodeReferenceIsValid(link.toType as EvidenceNodeType, link.toId, options)) {
    errors.push('link.toId must reference an existing node');
  }
  if (!EVIDENCE_RELATIONSHIPS.includes(link.relationship as EvidenceRelationship)) {
    errors.push('link.relationship is invalid');
  }
  if (link.label !== undefined && (!isString(link.label) || link.label.length > 120)) {
    errors.push('link.label must be up to 120 characters when provided');
  }
  if (!isNumber(link.createdAt)) errors.push('link.createdAt must be a timestamp');
  if (!isNumber(link.updatedAt)) errors.push('link.updatedAt must be a timestamp');

  return result(errors);
}

export function validateEvidenceCanvasView(value: unknown, options: ReferenceOptions = {}): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) return result(['evidence canvas view must be an object']);

  const view = value as Partial<EvidenceCanvasView>;
  const targetIds = referenceSet(options.targetIds);

  if (!isString(view.id) || !isValidUUID(view.id)) errors.push('canvasView.id must be a UUID v4');
  if (!isString(view.name) || view.name.trim().length === 0 || view.name.length > 80) {
    errors.push('canvasView.name must be 1-80 characters');
  }
  if (view.targetId !== undefined && (!isString(view.targetId) || (targetIds && !targetIds.has(view.targetId)))) {
    errors.push('canvasView.targetId must reference an existing target');
  }
  if (!isBoolean(view.includeSessions)) errors.push('canvasView.includeSessions must be a boolean');
  if (!isBoolean(view.includeNotes)) errors.push('canvasView.includeNotes must be a boolean');
  if (!isBoolean(view.includeUrls)) errors.push('canvasView.includeUrls must be a boolean');
  if (!isRecord(view.positions)) {
    errors.push('canvasView.positions must be an object');
  } else {
    for (const [key, position] of Object.entries(view.positions)) {
      if (!isRecord(position) || !isNumber(position.x) || !isNumber(position.y)) {
        errors.push(`canvasView.positions.${key} must include numeric x and y`);
      }
    }
  }
  if (!isNumber(view.zoom) || view.zoom <= 0 || view.zoom > 4) {
    errors.push('canvasView.zoom must be between 0 and 4');
  }
  if (!isNumber(view.panX)) errors.push('canvasView.panX must be a number');
  if (!isNumber(view.panY)) errors.push('canvasView.panY must be a number');
  if (!isNumber(view.createdAt)) errors.push('canvasView.createdAt must be a timestamp');
  if (!isNumber(view.updatedAt)) errors.push('canvasView.updatedAt must be a timestamp');

  return result(errors);
}

export function validateNoteTemplate(value: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) return result(['template must be an object']);

  const template = value as Partial<NoteTemplate>;

  if (!isString(template.id) || template.id.trim().length === 0) errors.push('template.id is required');
  if (!isString(template.name) || template.name.trim().length === 0) errors.push('template.name is required');
  if (!isValidTemplateCategory(template.category)) errors.push('template.category is invalid');
  if (!isString(template.content)) errors.push('template.content must be a string');
  if (!isBoolean(template.isBuiltIn)) errors.push('template.isBuiltIn must be a boolean');
  if (template.isCustom !== undefined && !isBoolean(template.isCustom)) {
    errors.push('template.isCustom must be a boolean when provided');
  }

  return result(errors);
}

export function validateSettings(value: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) return result(['settings must be an object']);

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
  if (!FONT_SIZES.includes(settings.fontSize as Settings['fontSize'])) errors.push('settings.fontSize is invalid');
  if (!isBoolean(settings.onboardingCompleted)) {
    errors.push('settings.onboardingCompleted must be a boolean');
  }
  if (settings.lastExportAt !== undefined && !isNumber(settings.lastExportAt)) {
    errors.push('settings.lastExportAt must be a timestamp when provided');
  }

  return result(errors);
}

export function validateHuntFlowExport(value: unknown, options: ReferenceOptions = {}): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) return result(['export must be an object']);

  const exportData = value as Partial<HuntFlowExport>;

  if (!isRecord(exportData.meta)) {
    errors.push('export.meta must be an object');
  } else {
    if (exportData.meta.version !== '1.0') errors.push('export.meta.version must be "1.0"');
    if (!isNumber(exportData.meta.exportedAt)) errors.push('export.meta.exportedAt must be a timestamp');
    if (!isString(exportData.meta.appVersion)) errors.push('export.meta.appVersion must be a string');
  }

  if (!isRecord(exportData.data)) return result([...errors, 'export.data must be an object']);

  const data = exportData.data as Record<string, unknown>;
  const targets = Array.isArray(data.targets) ? data.targets : [];
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  const notes = Array.isArray(data.notes) ? data.notes : [];
  const evidenceAssets = Array.isArray(data.evidenceAssets) ? data.evidenceAssets : [];
  const evidenceLinks = Array.isArray(data.evidenceLinks) ? data.evidenceLinks : [];
  const evidenceCanvasViews = Array.isArray(data.evidenceCanvasViews) ? data.evidenceCanvasViews : [];

  if (!Array.isArray(data.targets)) errors.push('export.data.targets must be an array');
  if (!Array.isArray(data.sessions)) errors.push('export.data.sessions must be an array');
  if (!Array.isArray(data.notes)) errors.push('export.data.notes must be an array');
  if (data.evidenceAssets !== undefined && !Array.isArray(data.evidenceAssets)) {
    errors.push('export.data.evidenceAssets must be an array when provided');
  }
  if (data.evidenceLinks !== undefined && !Array.isArray(data.evidenceLinks)) {
    errors.push('export.data.evidenceLinks must be an array when provided');
  }
  if (data.evidenceCanvasViews !== undefined && !Array.isArray(data.evidenceCanvasViews)) {
    errors.push('export.data.evidenceCanvasViews must be an array when provided');
  }

  const targetIds = new Set([...(options.targetIds ?? []), ...targets.map((target) => (target as Target).id)]);
  const sessionIds = new Set([...(options.sessionIds ?? []), ...sessions.map((session) => (session as Session).id)]);
  const noteIds = new Set([...(options.noteIds ?? []), ...notes.map((note) => (note as Note).id)]);
  const assetIds = new Set([
    ...(options.assetIds ?? []),
    ...evidenceAssets.map((asset) => (asset as EvidenceAsset).id)
  ]);

  targets.forEach((target, index) => {
    errors.push(...validateTarget(target).errors.map((error) => `targets[${index}]: ${error}`));
  });

  sessions.forEach((session, index) => {
    errors.push(
      ...validateSession(session, { targetIds, now: options.now }).errors.map(
        (error) => `sessions[${index}]: ${error}`
      )
    );
  });

  notes.forEach((note, index) => {
    errors.push(
      ...validateNote(note, { targetIds, sessionIds }).errors.map((error) => `notes[${index}]: ${error}`)
    );
  });

  evidenceAssets.forEach((asset, index) => {
    errors.push(
      ...validateEvidenceAsset(asset, { targetIds, sessionIds, noteIds }).errors.map(
        (error) => `evidenceAssets[${index}]: ${error}`
      )
    );
  });

  evidenceLinks.forEach((link, index) => {
    errors.push(
      ...validateEvidenceLink(link, { targetIds, sessionIds, noteIds, assetIds }).errors.map(
        (error) => `evidenceLinks[${index}]: ${error}`
      )
    );
  });

  evidenceCanvasViews.forEach((view, index) => {
    errors.push(
      ...validateEvidenceCanvasView(view, { targetIds }).errors.map(
        (error) => `evidenceCanvasViews[${index}]: ${error}`
      )
    );
  });

  errors.push(...validateSettings(data.settings).errors.map((error) => `settings: ${error}`));

  return result(errors);
}

export const isValidTarget = (value: unknown): value is Target => validateTarget(value).valid;
export const isValidSession = (value: unknown, options?: ReferenceOptions): value is Session =>
  validateSession(value, options).valid;
export const isValidNote = (value: unknown, options?: ReferenceOptions): value is Note =>
  validateNote(value, options).valid;
export const isValidEvidenceAsset = (value: unknown, options?: ReferenceOptions): value is EvidenceAsset =>
  validateEvidenceAsset(value, options).valid;
export const isValidEvidenceLink = (value: unknown, options?: ReferenceOptions): value is EvidenceLink =>
  validateEvidenceLink(value, options).valid;
export const isValidEvidenceCanvasView = (
  value: unknown,
  options?: ReferenceOptions
): value is EvidenceCanvasView => validateEvidenceCanvasView(value, options).valid;
export const isValidNoteTemplate = (value: unknown): value is NoteTemplate => validateNoteTemplate(value).valid;
export const isValidSettings = (value: unknown): value is Settings => validateSettings(value).valid;
export const isValidHuntFlowExport = (value: unknown, options?: ReferenceOptions): value is HuntFlowExport =>
  validateHuntFlowExport(value, options).valid;
