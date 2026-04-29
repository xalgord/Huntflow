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
import type { HuntFlowExport } from './schema';

export async function exportData(appVersion = '1.0.0'): Promise<HuntFlowExport> {
  const [
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
  ] = await Promise.all([
    sessionDB.getAll(),
    noteDB.getAll(),
    targetDB.getAll(),
    payoutDB.getAll(),
    evidenceAssetDB.getAll(),
    evidenceLinkDB.getAll(),
    evidenceCanvasViewDB.getAll(),
    reconAssetDB.getAll(),
    payloadDB.getAll(),
    checklistTemplateDB.getAll(),
    checklistInstanceDB.getAll(),
    submissionDB.getAll(),
    bookmarkDB.getAll(),
    settingsDB.getSettings()
  ]);

  return {
    meta: {
      version: '1.0',
      exportedAt: Date.now(),
      appVersion
    },
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

export async function exportDataAsJson(appVersion = '1.0.0'): Promise<string> {
  return JSON.stringify(await exportData(appVersion), null, 2);
}
