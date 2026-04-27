export {
  getSessionsByStatus,
  getSessionsByTarget,
  sessionStore
} from './sessionStore';
export {
  getTargetsByPlatform,
  getTargetsByPriority,
  getTargetsByStatus,
  targetStore
} from './targetStore';
export {
  getNotesBySession,
  getNotesByTag,
  getNotesByTarget,
  getNotesByTemplate,
  noteStore
} from './noteStore';
export {
  deleteEvidenceBlob,
  evidenceAssetStore,
  evidenceCanvasViewStore,
  evidenceLinkStore,
  getEvidenceAssetsByKind,
  getEvidenceAssetsByNote,
  getEvidenceAssetsBySession,
  getEvidenceAssetsBySyncState,
  getEvidenceAssetsByTag,
  getEvidenceAssetsByTarget,
  getEvidenceBlob,
  getEvidenceLinksByNode,
  getEvidenceLinksByRelationship,
  putEvidenceBlob
} from './evidenceStore';
export {
  getPayoutsByPlatform,
  getPayoutsBySeverity,
  getPayoutsByStatus,
  payoutStore
} from './payoutStore';
export { settingsStore } from './settingsStore';
export {
  avgSessionLengthStore,
  bestStreakStore,
  byVulnTypeStore,
  completedSessionsStore,
  dailyStatsStore,
  streakStore,
  todayMinutesStore,
  totalTimeStore,
  userStatsStore
} from './statsStore';
export { timerStore } from './timerStore';
export {
  getReconAssetsByTarget,
  reconAssetStore
} from './reconStore';
export {
  getPayloadsByCategory,
  payloadStore,
  recordPayloadUse
} from './payloadStore';
export {
  checklistInstanceStore,
  checklistTemplateStore,
  getChecklistInstancesByTarget
} from './checklistStore';
export {
  getSubmissionsByStatus,
  getSubmissionsByTarget,
  submissionStore
} from './submissionStore';
export {
  bookmarkStore,
  getBookmarksByCategory
} from './bookmarkStore';
export type { PersistedArrayStore } from './persistedArrayStore';

import { evidenceAssetStore, evidenceCanvasViewStore, evidenceLinkStore } from './evidenceStore';
import { bookmarkStore } from './bookmarkStore';
import { checklistInstanceStore, checklistTemplateStore } from './checklistStore';
import { noteStore } from './noteStore';
import { payloadStore } from './payloadStore';
import { payoutStore } from './payoutStore';
import { reconAssetStore } from './reconStore';
import { sessionStore } from './sessionStore';
import { settingsStore } from './settingsStore';
import { submissionStore } from './submissionStore';
import { targetStore } from './targetStore';

/**
 * Drain every store's debounced write buffer to IndexedDB. Call this on
 * `pagehide`/`beforeunload` so the latest in-memory state survives a tab
 * close that happens within the 500ms debounce window. Errors are swallowed
 * because we cannot show UI mid-unload.
 */
export async function flushAllStores(): Promise<void> {
  const stores: Array<{ persistNow: () => Promise<void> }> = [
    bookmarkStore,
    checklistInstanceStore,
    checklistTemplateStore,
    evidenceAssetStore,
    evidenceCanvasViewStore,
    evidenceLinkStore,
    noteStore,
    payloadStore,
    payoutStore,
    reconAssetStore,
    sessionStore,
    settingsStore,
    submissionStore,
    targetStore
  ];
  await Promise.all(
    stores.map((store) =>
      store.persistNow().catch(() => {
        /* unload context: nothing useful to do with the error */
      })
    )
  );
}
