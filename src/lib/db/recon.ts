import { BaseDB } from './baseStore';
import type { ReconAsset } from './schema';

class ReconAssetDB extends BaseDB<ReconAsset> {
  constructor() {
    super('reconAssets', 'reconAssets');
  }

  getByTarget(targetId: string): Promise<ReconAsset[]> {
    return this.getByIndex('by-target', targetId);
  }
}

export const reconAssetDB = new ReconAssetDB();
