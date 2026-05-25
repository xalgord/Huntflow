import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('$lib/stores', () => {
  const stores: Record<string, unknown[]> = {
    sessionStore: [],
    noteStore: [],
    reconAssetStore: [],
    evidenceAssetStore: [],
    evidenceLinkStore: [],
    checklistInstanceStore: [],
    submissionStore: [],
    payoutStore: [],
    targetStore: []
  };

  function createStore(name: string) {
    return {
      subscribe: (fn: (value: unknown[]) => void) => {
        fn(stores[name]);
        return () => {};
      },
      delete: vi.fn().mockResolvedValue(undefined)
    };
  }

  return {
    sessionStore: createStore('sessionStore'),
    noteStore: createStore('noteStore'),
    reconAssetStore: createStore('reconAssetStore'),
    evidenceAssetStore: createStore('evidenceAssetStore'),
    evidenceLinkStore: createStore('evidenceLinkStore'),
    checklistInstanceStore: createStore('checklistInstanceStore'),
    submissionStore: createStore('submissionStore'),
    payoutStore: createStore('payoutStore'),
    targetStore: createStore('targetStore'),
    flushAllStores: vi.fn().mockResolvedValue(undefined),
    __setStoreData: (name: string, data: unknown[]) => {
      stores[name] = data;
    }
  };
});

import { previewTargetCascade, deleteTargetCascade } from './cascade';

const TARGET_ID = 'target-1';

describe('previewTargetCascade', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('$lib/stores') as unknown as Record<string, (name: string, data: unknown[]) => void>;
    mod.__setStoreData('sessionStore', [
      { id: 's1', targetId: TARGET_ID },
      { id: 's2', targetId: 'other' }
    ]);
    mod.__setStoreData('noteStore', [
      { id: 'n1', targetId: TARGET_ID },
      { id: 'n2', targetId: TARGET_ID },
      { id: 'n3', targetId: 'other' }
    ]);
    mod.__setStoreData('reconAssetStore', [
      { id: 'r1', targetId: TARGET_ID }
    ]);
    mod.__setStoreData('evidenceAssetStore', [
      { id: 'a1', targetId: TARGET_ID },
      { id: 'a2', targetId: 'other' }
    ]);
    mod.__setStoreData('evidenceLinkStore', [
      { id: 'l1', fromType: 'target', fromId: TARGET_ID, toType: 'note', toId: 'n1' },
      { id: 'l2', fromType: 'target', fromId: 'other', toType: 'note', toId: 'n3' }
    ]);
    mod.__setStoreData('checklistInstanceStore', [
      { id: 'ci1', targetId: TARGET_ID }
    ]);
    mod.__setStoreData('submissionStore', [
      { id: 'sub1', targetId: TARGET_ID, payoutIds: ['p1'] },
      { id: 'sub2', targetId: 'other', payoutIds: [] }
    ]);
    mod.__setStoreData('payoutStore', [
      { id: 'p1', amount: 500 },
      { id: 'p2', amount: 1000 }
    ]);
  });

  it('counts child rows referencing the target', () => {
    const preview = previewTargetCascade(TARGET_ID);
    expect(preview.sessions).toBe(1);
    expect(preview.notes).toBe(2);
    expect(preview.reconAssets).toBe(1);
    expect(preview.evidenceAssets).toBe(1);
    expect(preview.evidenceLinks).toBe(1);
    expect(preview.checklistInstances).toBe(1);
    expect(preview.submissions).toBe(1);
    expect(preview.payouts).toBe(1);
  });

  it('returns all zeros for non-existent target', () => {
    const preview = previewTargetCascade('nonexistent');
    expect(preview.sessions).toBe(0);
    expect(preview.notes).toBe(0);
    expect(preview.reconAssets).toBe(0);
    expect(preview.evidenceAssets).toBe(0);
    expect(preview.evidenceLinks).toBe(0);
    expect(preview.checklistInstances).toBe(0);
    expect(preview.submissions).toBe(0);
    expect(preview.payouts).toBe(0);
  });
});

describe('deleteTargetCascade', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('$lib/stores') as unknown as Record<string, (name: string, data: unknown[]) => void>;
    mod.__setStoreData('sessionStore', [
      { id: 's1', targetId: TARGET_ID }
    ]);
    mod.__setStoreData('noteStore', []);
    mod.__setStoreData('reconAssetStore', []);
    mod.__setStoreData('evidenceAssetStore', []);
    mod.__setStoreData('evidenceLinkStore', []);
    mod.__setStoreData('checklistInstanceStore', []);
    mod.__setStoreData('submissionStore', []);
    mod.__setStoreData('payoutStore', []);
    mod.__setStoreData('targetStore', [
      { id: TARGET_ID, name: 'Test' }
    ]);
  });

  it('returns a preview matching the cascade counts', async () => {
    const result = await deleteTargetCascade(TARGET_ID);
    expect(result.sessions).toBe(1);
    expect(result.notes).toBe(0);
  });

  it('calls delete on each affected store with correct IDs', async () => {
    await deleteTargetCascade(TARGET_ID);
    const mod = await import('$lib/stores') as unknown as Record<string, { delete: ReturnType<typeof vi.fn> }>;
    expect(mod.sessionStore.delete).toHaveBeenCalledWith('s1');
    expect(mod.targetStore.delete).toHaveBeenCalledWith(TARGET_ID);
  });

  it('calls flushAllStores after deletion', async () => {
    const mod = await import('$lib/stores') as unknown as Record<string, () => Promise<void>>;
    await deleteTargetCascade(TARGET_ID);
    expect(mod.flushAllStores).toHaveBeenCalled();
  });
});
