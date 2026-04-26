import { exportData } from '$lib/db/export';
import { importData } from '$lib/db/import';
import type { HuntFlowExport } from '$lib/types';
import { formatDateKey } from './time';

export async function exportToJSON(data?: HuntFlowExport): Promise<HuntFlowExport> {
  const payload = data ?? (await exportData());
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = `huntflow-export-${formatDateKey(Date.now())}.json`;
  anchor.click();
  URL.revokeObjectURL(url);

  return payload;
}

export async function importFromJSON(file: File): Promise<HuntFlowExport> {
  const text = await file.text();
  return importData(text);
}
