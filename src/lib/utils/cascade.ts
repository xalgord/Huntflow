import { get } from 'svelte/store';
import {
  checklistInstanceStore,
  evidenceAssetStore,
  evidenceLinkStore,
  flushAllStores,
  noteStore,
  payoutStore,
  reconAssetStore,
  sessionStore,
  submissionStore,
  targetStore
} from '$lib/stores';

/**
 * Summary of how many child rows will be (or were) removed when a target
 * is deleted. Surfaced in confirm dialogs so the user knows the blast radius
 * before clicking "Delete Target".
 */
export interface TargetCascadePreview {
  sessions: number;
  notes: number;
  reconAssets: number;
  evidenceAssets: number;
  evidenceLinks: number;
  checklistInstances: number;
  submissions: number;
  payouts: number;
}

/**
 * Count every store row that references a given target. Pure read — does
 * not mutate state.
 */
export function previewTargetCascade(targetId: string): TargetCascadePreview {
  const sessions = get(sessionStore).filter((s) => s.targetId === targetId).length;
  const notes = get(noteStore).filter((n) => n.targetId === targetId).length;
  const reconAssets = get(reconAssetStore).filter((a) => a.targetId === targetId).length;
  const evidenceAssetIds = new Set(
    get(evidenceAssetStore)
      .filter((a) => a.targetId === targetId)
      .map((a) => a.id)
  );
  const evidenceLinks = get(evidenceLinkStore).filter(
    (l) =>
      (l.fromType === 'target' && l.fromId === targetId) ||
      (l.toType === 'target' && l.toId === targetId) ||
      (l.fromType === 'asset' && evidenceAssetIds.has(l.fromId)) ||
      (l.toType === 'asset' && evidenceAssetIds.has(l.toId))
  ).length;
  const checklistInstances = get(checklistInstanceStore).filter(
    (i) => i.targetId === targetId
  ).length;
  const targetSubmissions = get(submissionStore).filter((s) => s.targetId === targetId);
  const submissions = targetSubmissions.length;
  const payoutIdSet = new Set(targetSubmissions.flatMap((s) => s.payoutIds ?? []));
  const payouts = get(payoutStore).filter((p) => payoutIdSet.has(p.id)).length;

  return {
    sessions,
    notes,
    reconAssets,
    evidenceAssets: evidenceAssetIds.size,
    evidenceLinks,
    checklistInstances,
    submissions,
    payouts
  };
}

/**
 * Cascading delete: removes the target and every row in every other store
 * that references it. Evidence blobs are removed alongside their asset rows
 * (the evidence store's `delete()` already cleans up the IndexedDB blob).
 *
 * Idempotent — calling twice is a no-op the second time. Errors propagate
 * so the UI can show them; the global pagehide flush will still drain any
 * partial progress to disk.
 */
export async function deleteTargetCascade(targetId: string): Promise<TargetCascadePreview> {
  const preview = previewTargetCascade(targetId);

  // Collect all child IDs first so subsequent store deletes don't race against
  // reactive recomputation that would shift the indexes mid-loop.
  const sessionIds = get(sessionStore)
    .filter((s) => s.targetId === targetId)
    .map((s) => s.id);
  const noteIds = get(noteStore)
    .filter((n) => n.targetId === targetId)
    .map((n) => n.id);
  const reconIds = get(reconAssetStore)
    .filter((a) => a.targetId === targetId)
    .map((a) => a.id);
  const evidenceAssetIds = get(evidenceAssetStore)
    .filter((a) => a.targetId === targetId)
    .map((a) => a.id);
  const evidenceAssetIdSet = new Set(evidenceAssetIds);
  const linkIds = get(evidenceLinkStore)
    .filter(
      (l) =>
        (l.fromType === 'target' && l.fromId === targetId) ||
        (l.toType === 'target' && l.toId === targetId) ||
        (l.fromType === 'asset' && evidenceAssetIdSet.has(l.fromId)) ||
        (l.toType === 'asset' && evidenceAssetIdSet.has(l.toId))
    )
    .map((l) => l.id);
  const checklistIds = get(checklistInstanceStore)
    .filter((i) => i.targetId === targetId)
    .map((i) => i.id);
  const targetSubs = get(submissionStore).filter((s) => s.targetId === targetId);
  const submissionIds = targetSubs.map((s) => s.id);
  const payoutIdSet = new Set(targetSubs.flatMap((s) => s.payoutIds ?? []));
  const payoutIds = get(payoutStore)
    .filter((p) => payoutIdSet.has(p.id))
    .map((p) => p.id);

  // Run deletes in parallel within each store, sequentially across stores.
  // Errors in one store don't prevent cleanup of subsequent stores.
  const errors: { store: string; error: unknown }[] = [];

  async function safeDeleteAll(storeName: string, ids: string[], deleteFn: (id: string) => Promise<void>): Promise<void> {
    try {
      await Promise.all(ids.map((id) => deleteFn(id)));
    } catch (error) {
      errors.push({ store: storeName, error });
    }
  }

  await safeDeleteAll('evidenceLinks', linkIds, (id) => evidenceLinkStore.delete(id));
  await safeDeleteAll('evidenceAssets', evidenceAssetIds, (id) => evidenceAssetStore.delete(id));
  await safeDeleteAll('notes', noteIds, (id) => noteStore.delete(id));
  await safeDeleteAll('reconAssets', reconIds, (id) => reconAssetStore.delete(id));
  await safeDeleteAll('checklistInstances', checklistIds, (id) => checklistInstanceStore.delete(id));
  await safeDeleteAll('submissions', submissionIds, (id) => submissionStore.delete(id));
  await safeDeleteAll('payouts', payoutIds, (id) => payoutStore.delete(id));
  await safeDeleteAll('sessions', sessionIds, (id) => sessionStore.delete(id));
  await safeDeleteAll('targets', [targetId], (id) => targetStore.delete(id));

  // Drain debounced writes so the cascade is durable immediately, even if
  // the user closes the tab right after confirming.
  await flushAllStores();

  if (errors.length > 0) {
    const summary = errors.map((e) => `${e.store}: ${String(e.error)}`).join('; ');
    console.error('Cascade delete encountered errors:', errors);
    throw new Error(`Cascade delete partially failed: ${summary}`);
  }

  return preview;
}
