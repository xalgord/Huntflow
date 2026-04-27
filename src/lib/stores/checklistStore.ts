import { checklistInstanceDB, checklistTemplateDB } from '$lib/db/checklists';
import { BUILT_IN_CHECKLIST_TEMPLATES } from '$lib/seeds/checklists';
import type { ChecklistInstance, ChecklistTemplate } from '$lib/types';
import { createPersistedArrayStore } from './persistedArrayStore';

const templateBase = createPersistedArrayStore<ChecklistTemplate>(checklistTemplateDB, {
  sort: (a, b) => {
    if (a.isBuiltIn !== b.isBuiltIn) return a.isBuiltIn ? -1 : 1;
    return a.name.localeCompare(b.name);
  }
});

let templatesSeeded = false;
let templatesSeedingPromise: Promise<void> | null = null;

async function ensureTemplatesSeeded(): Promise<void> {
  if (templatesSeeded) return;
  if (templatesSeedingPromise) return templatesSeedingPromise;

  templatesSeedingPromise = (async () => {
    const items = await templateBase.load();
    if (items.length === 0) {
      await templateBase.set(BUILT_IN_CHECKLIST_TEMPLATES);
      await templateBase.persistNow();
    } else {
      const existingIds = new Set(items.map((item) => item.id));
      const missing = BUILT_IN_CHECKLIST_TEMPLATES.filter((seed) => !existingIds.has(seed.id));
      if (missing.length > 0) {
        await templateBase.putBatch(missing);
        await templateBase.persistNow();
      }
    }
    templatesSeeded = true;
  })();

  try {
    await templatesSeedingPromise;
  } finally {
    templatesSeedingPromise = null;
  }
}

export const checklistTemplateStore = {
  ...templateBase,
  async load() {
    await ensureTemplatesSeeded();
    return templateBase.load();
  },
  async refresh() {
    templatesSeeded = false;
    return templateBase.refresh();
  }
};

export const checklistInstanceStore = createPersistedArrayStore<ChecklistInstance>(
  checklistInstanceDB,
  {
    sort: (a, b) => b.updatedAt - a.updatedAt
  }
);

export async function getChecklistInstancesByTarget(targetId: string): Promise<ChecklistInstance[]> {
  await checklistInstanceStore.load();
  return checklistInstanceDB.getByTarget(targetId);
}
