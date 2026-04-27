import { payloadDB } from '$lib/db/payloads';
import { BUILT_IN_PAYLOADS } from '$lib/seeds/payloads';
import type { Payload, PayloadCategory } from '$lib/types';
import { createPersistedArrayStore } from './persistedArrayStore';

const baseStore = createPersistedArrayStore<Payload>(payloadDB, {
  sort: (a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    if (b.useCount !== a.useCount) return b.useCount - a.useCount;
    return a.name.localeCompare(b.name);
  }
});

let seeded = false;
let seedingPromise: Promise<void> | null = null;

async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  // Dedup concurrent callers so we never seed twice in parallel.
  if (seedingPromise) return seedingPromise;

  seedingPromise = (async () => {
    const items = await baseStore.load();
    if (items.length === 0) {
      await baseStore.set(BUILT_IN_PAYLOADS);
      await baseStore.persistNow();
    } else {
      // Merge in any new built-ins added in app updates without overwriting user edits.
      const existingIds = new Set(items.map((item) => item.id));
      const missing = BUILT_IN_PAYLOADS.filter((seed) => !existingIds.has(seed.id));
      if (missing.length > 0) {
        await baseStore.putBatch(missing);
        await baseStore.persistNow();
      }
    }
    seeded = true;
  })();

  try {
    await seedingPromise;
  } finally {
    seedingPromise = null;
  }
}

export const payloadStore = {
  ...baseStore,
  async load() {
    await ensureSeeded();
    return baseStore.load();
  },
  async refresh() {
    seeded = false;
    return baseStore.refresh();
  }
};

export async function getPayloadsByCategory(category: PayloadCategory): Promise<Payload[]> {
  await payloadStore.load();
  return payloadDB.getByCategory(category);
}

export async function recordPayloadUse(id: string): Promise<void> {
  const payload = baseStore.getById(id);
  if (!payload) return;
  await baseStore.put({
    ...payload,
    useCount: payload.useCount + 1,
    lastUsedAt: Date.now(),
    updatedAt: Date.now()
  });
  // Persist immediately so usage stats survive a quick tab close.
  await baseStore.persistNow();
}
