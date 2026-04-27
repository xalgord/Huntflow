import { reconAssetDB } from '$lib/db/recon';
import type { ReconAsset } from '$lib/types';
import { createPersistedArrayStore } from './persistedArrayStore';

export const reconAssetStore = createPersistedArrayStore<ReconAsset>(reconAssetDB, {
  sort: (a, b) => b.updatedAt - a.updatedAt
});

export async function getReconAssetsByTarget(targetId: string): Promise<ReconAsset[]> {
  await reconAssetStore.load();
  return reconAssetDB.getByTarget(targetId);
}
