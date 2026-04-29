import { browser } from '$app/environment';
import { writable, type Readable } from 'svelte/store';

type PersistedArrayDB<T extends { id: string }> = {
  getAll(): Promise<T[]>;
  put(item: T): Promise<void>;
  putBatch(items: T[]): Promise<void>;
  delete(id: string): Promise<void>;
};

interface PersistedArrayStoreOptions<T> {
  sort?: (a: T, b: T) => number;
}

export interface PersistedArrayStore<T extends { id: string }> extends Readable<T[]> {
  load(): Promise<T[]>;
  refresh(): Promise<T[]>;
  set(items: T[]): Promise<void>;
  update(updater: (items: T[]) => T[]): Promise<void>;
  put(item: T): Promise<void>;
  putBatch(items: T[]): Promise<void>;
  delete(id: string): Promise<void>;
  getById(id: string): T | undefined;
  persistNow(): Promise<void>;
}

export function createPersistedArrayStore<T extends { id: string }>(
  db: PersistedArrayDB<T>,
  options: PersistedArrayStoreOptions<T> = {}
): PersistedArrayStore<T> {
  const source = writable<T[]>([]);
  let value: T[] = [];
  let loaded = false;
  let loading: Promise<T[]> | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const pendingDeletes = new Set<string>();
  /** IDs of items that have been added or modified since the last flush. */
  const dirtyIds = new Set<string>();

  source.subscribe((items) => {
    value = items;
  });

  function normalize(items: T[]): T[] {
    const next = [...items];
    if (options.sort) next.sort(options.sort);
    return next;
  }

  async function flush(): Promise<void> {
    if (!browser || !loaded) return;

    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }

    const deletes = Array.from(pendingDeletes);
    pendingDeletes.clear();

    // Only persist items that changed since the last flush instead of
    // rewriting the entire array on every save cycle.
    const dirty = Array.from(dirtyIds);
    dirtyIds.clear();

    await Promise.all(deletes.map((id) => db.delete(id)));

    if (dirty.length > 0) {
      const dirtySet = new Set(dirty);
      const dirtyItems = value.filter((item) => dirtySet.has(item.id));
      if (dirtyItems.length > 0) {
        await db.putBatch(dirtyItems);
      }
    }
  }

  function scheduleSave(): void {
    if (!browser || !loaded) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void flush();
    }, 500);
  }

  async function load(): Promise<T[]> {
    if (!browser) return value;
    if (loaded) return value;
    if (loading) return loading;

    loading = db.getAll().then((items) => {
      const next = normalize(items);
      loaded = true;
      source.set(next);
      return next;
    });

    try {
      return await loading;
    } finally {
      loading = null;
    }
  }

  async function refresh(): Promise<T[]> {
    loaded = false;
    return load();
  }

  async function setItems(items: T[]): Promise<void> {
    await load();
    // Full replacement — mark every item dirty
    for (const item of items) dirtyIds.add(item.id);
    source.set(normalize(items));
    scheduleSave();
  }

  async function updateItems(updater: (items: T[]) => T[]): Promise<void> {
    await load();
    source.update((items) => normalize(updater([...items])));
    scheduleSave();
  }

  async function put(item: T): Promise<void> {
    pendingDeletes.delete(item.id);
    dirtyIds.add(item.id);
    await updateItems((items) => {
      const index = items.findIndex((candidate) => candidate.id === item.id);
      if (index === -1) return [...items, item];

      const next = [...items];
      next[index] = item;
      return next;
    });
  }

  async function putBatch(items: T[]): Promise<void> {
    for (const item of items) {
      pendingDeletes.delete(item.id);
      dirtyIds.add(item.id);
    }
    await updateItems((current) => {
      const byId = new Map(current.map((item) => [item.id, item]));
      for (const item of items) byId.set(item.id, item);
      return Array.from(byId.values());
    });
  }

  async function remove(id: string): Promise<void> {
    await load();
    pendingDeletes.add(id);
    source.update((items) => items.filter((item) => item.id !== id));
    scheduleSave();
  }

  return {
    subscribe(run, invalidate) {
      load().catch((err) => {
        console.error('[persistedArrayStore] initial load failed:', err);
      });
      return source.subscribe(run, invalidate);
    },
    load,
    refresh,
    set: setItems,
    update: updateItems,
    put,
    putBatch,
    delete: remove,
    getById(id) {
      return value.find((item) => item.id === id);
    },
    persistNow: flush
  };
}
