import { evidenceAssetDB, evidenceCanvasViewDB, evidenceLinkDB } from './evidence';
import { noteDB } from './notes';
import { payoutDB } from './payouts';
import { sessionDB } from './sessions';
import { settingsDB } from './settings';
import { targetDB } from './targets';
import type { HuntFlowExport } from './schema';

export async function exportData(appVersion = '1.0.0'): Promise<HuntFlowExport> {
  const [sessions, notes, targets, payouts, evidenceAssets, evidenceLinks, evidenceCanvasViews, settings] =
    await Promise.all([
      sessionDB.getAll(),
      noteDB.getAll(),
      targetDB.getAll(),
      payoutDB.getAll(),
      evidenceAssetDB.getAll(),
      evidenceLinkDB.getAll(),
      evidenceCanvasViewDB.getAll(),
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
      settings
    }
  };
}

export async function exportDataAsJson(appVersion = '1.0.0'): Promise<string> {
  return JSON.stringify(await exportData(appVersion), null, 2);
}
