import { bookmarkDB } from '$lib/db/bookmarks';
import { BUILT_IN_BOOKMARKS } from '$lib/seeds/bookmarks';
import type { Bookmark, BookmarkCategory } from '$lib/types';
import { createPersistedArrayStore } from './persistedArrayStore';

const baseStore = createPersistedArrayStore<Bookmark>(bookmarkDB, {
  sort: (a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return a.title.localeCompare(b.title);
  }
});

let seeded = false;

async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  const items = await baseStore.load();
  if (items.length === 0) {
    await baseStore.set(BUILT_IN_BOOKMARKS);
    await baseStore.persistNow();
  } else {
    const existingIds = new Set(items.map((item) => item.id));
    const missing = BUILT_IN_BOOKMARKS.filter((seed) => !existingIds.has(seed.id));
    if (missing.length > 0) {
      await baseStore.putBatch(missing);
      await baseStore.persistNow();
    }
  }
  seeded = true;
}

export const bookmarkStore = {
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

export async function getBookmarksByCategory(category: BookmarkCategory): Promise<Bookmark[]> {
  await bookmarkStore.load();
  return bookmarkDB.getByCategory(category);
}
