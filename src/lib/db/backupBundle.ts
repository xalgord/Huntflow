/**
 * Full-workspace backup bundle: collects every IndexedDB store HuntFlow
 * cares about, including evidence blob binaries, into a single JSON-friendly
 * payload that can then be encrypted via cryptoBackup.ts and saved as a file.
 *
 * The existing `db/export.ts` only covers a subset (sessions/notes/targets/
 * payouts/evidenceAssets/evidenceLinks/evidenceCanvasViews/settings) and
 * never serializes evidence blob binaries — meaning a "full export" today
 * silently loses screenshots/PDFs the user uploaded. This module fixes that
 * gap and is intended to be the canonical one-click backup pipeline.
 */
import { bookmarkDB } from './bookmarks';
import { checklistInstanceDB, checklistTemplateDB } from './checklists';
import {
  evidenceAssetDB,
  evidenceBlobDB,
  evidenceCanvasViewDB,
  evidenceLinkDB
} from './evidence';
import { getHuntFlowDB } from './index';
import { noteDB } from './notes';
import { payloadDB } from './payloads';
import { payoutDB } from './payouts';
import { reconAssetDB } from './recon';
import { sessionDB } from './sessions';
import { settingsDB } from './settings';
import { submissionDB } from './submissions';
import { targetDB } from './targets';
import { templateDB } from './templates';
import { base64ToBlob, blobToBase64 } from '$lib/utils/cryptoBackup';

/** Stores that don't expose a `.clear()` instance method — we wipe them via
 *  the raw IndexedDB transaction instead (mirrors what DataSettings does). */
const RAW_CLEAR_STORES = [
  'targets',
  'sessions',
  'notes',
  'payouts',
  'templates',
  'evidenceAssets',
  'evidenceBlobs',
  'evidenceLinks',
  'evidenceCanvasViews',
  'settings'
] as const;

async function clearRawStores(): Promise<void> {
  const db = await getHuntFlowDB();
  if (!db) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;
  for (const name of RAW_CLEAR_STORES) {
    try {
      await anyDb.clear(name);
    } catch {
      /* store might not exist on older schemas; ignore */
    }
  }
}

export const BUNDLE_VERSION = 1;

export interface SerializedEvidenceBlob {
  assetId: string;
  size: number;
  mimeType: string;
  updatedAt: number;
  /** Base64-encoded binary contents. Empty string means the blob was empty. */
  data: string;
}

export interface BackupPayload {
  bundleVersion: number;
  targets: unknown[];
  sessions: unknown[];
  notes: unknown[];
  payouts: unknown[];
  submissions: unknown[];
  payloads: unknown[];
  bookmarks: unknown[];
  reconAssets: unknown[];
  checklistTemplates: unknown[];
  checklistInstances: unknown[];
  noteTemplates: unknown[];
  evidenceAssets: unknown[];
  evidenceLinks: unknown[];
  evidenceCanvasViews: unknown[];
  /** Binary content for every evidence asset that has one. */
  evidenceBlobs: SerializedEvidenceBlob[];
  /** Settings as a single object (not array). */
  settings: unknown;
}

/** Counts shown in the metadata block (visible even on encrypted backups). */
export function totalsFromPayload(payload: BackupPayload): Record<string, number> {
  return {
    targets: payload.targets.length,
    sessions: payload.sessions.length,
    notes: payload.notes.length,
    payouts: payload.payouts.length,
    submissions: payload.submissions.length,
    payloads: payload.payloads.length,
    bookmarks: payload.bookmarks.length,
    reconAssets: payload.reconAssets.length,
    checklistInstances: payload.checklistInstances.length,
    noteTemplates: payload.noteTemplates.length,
    evidenceAssets: payload.evidenceAssets.length,
    evidenceBlobs: payload.evidenceBlobs.length
  };
}

export async function collectBackupPayload(): Promise<BackupPayload> {
  const [
    targets,
    sessions,
    notes,
    payouts,
    submissions,
    payloads,
    bookmarks,
    reconAssets,
    checklistTemplates,
    checklistInstances,
    noteTemplates,
    evidenceAssets,
    evidenceLinks,
    evidenceCanvasViews,
    evidenceBlobs,
    settings
  ] = await Promise.all([
    targetDB.getAll(),
    sessionDB.getAll(),
    noteDB.getAll(),
    payoutDB.getAll(),
    submissionDB.getAll(),
    payloadDB.getAll(),
    bookmarkDB.getAll(),
    reconAssetDB.getAll(),
    checklistTemplateDB.getAll(),
    checklistInstanceDB.getAll(),
    templateDB.getAll(),
    evidenceAssetDB.getAll(),
    evidenceLinkDB.getAll(),
    evidenceCanvasViewDB.getAll(),
    evidenceBlobDB.getAll(),
    settingsDB.getSettings()
  ]);

  // Serialize binary blobs to base64. We do this sequentially because each
  // one allocates ArrayBuffers and we don't want to OOM on huge workspaces.
  const serializedBlobs: SerializedEvidenceBlob[] = [];
  for (const blob of evidenceBlobs) {
    // Tolerate both the canonical `blob` field and the legacy `data`
    // alias so backup bundles taken before the rename still encode
    // properly. Newer writes always populate `blob`.
    const payload = (blob.blob ?? blob.data) as Blob | undefined;
    serializedBlobs.push({
      assetId: blob.assetId,
      size: blob.size,
      mimeType: blob.mimeType,
      updatedAt: blob.updatedAt,
      data: payload ? await blobToBase64(payload) : ''
    });
  }

  return {
    bundleVersion: BUNDLE_VERSION,
    targets,
    sessions,
    notes,
    payouts,
    submissions,
    payloads,
    bookmarks,
    reconAssets,
    checklistTemplates,
    checklistInstances,
    noteTemplates,
    evidenceAssets,
    evidenceLinks,
    evidenceCanvasViews,
    evidenceBlobs: serializedBlobs,
    settings
  };
}

// ─── Restore ─────────────────────────────────────────────────────────────────

export interface RestoreResult {
  totals: Record<string, number>;
  warnings: string[];
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Replaces the entire workspace with the supplied payload. Each store is
 * cleared then rewritten in batch. Failures are collected as warnings rather
 * than aborting the whole restore — partial recovery is better than no
 * recovery when one store has a schema drift.
 */
export async function restoreBackupPayload(rawPayload: unknown): Promise<RestoreResult> {
  if (!rawPayload || typeof rawPayload !== 'object') {
    throw new Error('Backup payload is not an object.');
  }
  const payload = rawPayload as Partial<BackupPayload>;
  const warnings: string[] = [];

  const safeRun = async (label: string, fn: () => Promise<void>): Promise<void> => {
    try {
      await fn();
    } catch (error) {
      warnings.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Wipe every store first so the restore is a clean replace, not a merge.
  // BaseDB-derived stores get .clear(); raw-store ones get cleared via the
  // underlying IDB transaction.
  await safeRun('clear:base-stores', async () => {
    await Promise.all([
      submissionDB.clear(),
      payloadDB.clear(),
      bookmarkDB.clear(),
      reconAssetDB.clear(),
      checklistTemplateDB.clear(),
      checklistInstanceDB.clear()
    ]);
  });
  await safeRun('clear:raw-stores', clearRawStores);

  // Settings — write through settingsDB.putSettings so the in-memory cache
  // updates and any subscribers re-render.
  await safeRun('settings', async () => {
    if (payload.settings && typeof payload.settings === 'object') {
      await settingsDB.putSettings(
        payload.settings as Parameters<typeof settingsDB.putSettings>[0]
      );
    }
  });

  const restores: Array<{ label: string; run: () => Promise<void> }> = [
    { label: 'targets', run: () => targetDB.putBatch(asArray(payload.targets)) },
    { label: 'sessions', run: () => sessionDB.putBatch(asArray(payload.sessions)) },
    { label: 'notes', run: () => noteDB.putBatch(asArray(payload.notes)) },
    { label: 'payouts', run: () => payoutDB.putBatch(asArray(payload.payouts)) },
    { label: 'submissions', run: () => submissionDB.putBatch(asArray(payload.submissions)) },
    { label: 'payloads', run: () => payloadDB.putBatch(asArray(payload.payloads)) },
    { label: 'bookmarks', run: () => bookmarkDB.putBatch(asArray(payload.bookmarks)) },
    { label: 'reconAssets', run: () => reconAssetDB.putBatch(asArray(payload.reconAssets)) },
    {
      label: 'checklistTemplates',
      run: () => checklistTemplateDB.putBatch(asArray(payload.checklistTemplates))
    },
    {
      label: 'checklistInstances',
      run: () => checklistInstanceDB.putBatch(asArray(payload.checklistInstances))
    },
    { label: 'noteTemplates', run: () => templateDB.putBatch(asArray(payload.noteTemplates)) },
    { label: 'evidenceAssets', run: () => evidenceAssetDB.putBatch(asArray(payload.evidenceAssets)) },
    { label: 'evidenceLinks', run: () => evidenceLinkDB.putBatch(asArray(payload.evidenceLinks)) },
    {
      label: 'evidenceCanvasViews',
      run: () => evidenceCanvasViewDB.putBatch(asArray(payload.evidenceCanvasViews))
    }
  ];

  for (const { label, run } of restores) {
    await safeRun(label, run);
  }

  // Evidence blobs — special-cased because blobs are binary, not plain rows.
  await safeRun('evidenceBlobs', async () => {
    const serialized = asArray<SerializedEvidenceBlob>(payload.evidenceBlobs);
    const restored = serialized.map((b) => {
      const decoded = b.data ? base64ToBlob(b.data, b.mimeType) : new Blob([], { type: b.mimeType });
      // Populate both `blob` (canonical) and `data` (legacy alias) so
      // restored bundles are readable by both code paths in the wild —
      // older copies of the assets/canvas/sync helpers still expect
      // `data`, and we don't want a restore to silently break them.
      return {
        assetId: b.assetId,
        size: b.size,
        mimeType: b.mimeType,
        updatedAt: b.updatedAt,
        blob: decoded,
        data: decoded
      };
    });
    await evidenceBlobDB.putBatch(restored);
  });

  return {
    totals: {
      targets: asArray(payload.targets).length,
      sessions: asArray(payload.sessions).length,
      notes: asArray(payload.notes).length,
      payouts: asArray(payload.payouts).length,
      submissions: asArray(payload.submissions).length,
      payloads: asArray(payload.payloads).length,
      bookmarks: asArray(payload.bookmarks).length,
      reconAssets: asArray(payload.reconAssets).length,
      checklistInstances: asArray(payload.checklistInstances).length,
      evidenceAssets: asArray(payload.evidenceAssets).length,
      evidenceBlobs: asArray(payload.evidenceBlobs).length
    },
    warnings
  };
}
