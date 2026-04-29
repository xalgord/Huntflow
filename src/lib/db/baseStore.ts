import { enableMemoryFallback, getHuntFlowDB, getMemoryDB } from './index';
import type { HuntFlowDB } from './schema';

type StoreName = keyof HuntFlowDB & (
  | 'reconAssets'
  | 'payloads'
  | 'checklistTemplates'
  | 'checklistInstances'
  | 'submissions'
  | 'bookmarks'
);

type MemoryKey =
  | 'reconAssets'
  | 'payloads'
  | 'checklistTemplates'
  | 'checklistInstances'
  | 'submissions'
  | 'bookmarks';

interface IndexedItem {
  id: string;
}

/**
 * Generic IndexedDB CRUD helper that mirrors the per-entity DB classes used
 * elsewhere in the codebase (TargetDB, PayoutDB, etc.) but eliminates the
 * boilerplate. It always falls back to the in-memory map if IndexedDB fails.
 */
export class BaseDB<T extends IndexedItem> {
  constructor(private storeName: StoreName, private memoryKey: MemoryKey) {}

  private memory(): Map<string, T> {
    return getMemoryDB()[this.memoryKey] as unknown as Map<string, T>;
  }

  async init(): Promise<void> {
    await getHuntFlowDB();
  }

  async getAll(): Promise<T[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(this.memory().values());
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (await (db as any).getAll(this.storeName)) as T[];
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(this.memory().values());
    }
  }

  async getById(id: string): Promise<T | undefined> {
    const db = await getHuntFlowDB();
    if (!db) return this.memory().get(id);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (await (db as any).get(this.storeName, id)) as T | undefined;
    } catch (error) {
      enableMemoryFallback(error);
      return this.memory().get(id);
    }
  }

  async put(item: T): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      this.memory().set(item.id, item);
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).put(this.storeName, item);
    } catch (error) {
      enableMemoryFallback(error);
      this.memory().set(item.id, item);
    }
  }

  async putBatch(items: T[]): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      for (const item of items) this.memory().set(item.id, item);
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = (db as any).transaction(this.storeName, 'readwrite');
      await Promise.all([...items.map((item) => tx.store.put(item)), tx.done]);
    } catch (error) {
      enableMemoryFallback(error);
      for (const item of items) this.memory().set(item.id, item);
    }
  }

  async delete(id: string): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      this.memory().delete(id);
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).delete(this.storeName, id);
    } catch (error) {
      enableMemoryFallback(error);
      this.memory().delete(id);
    }
  }

  /**
   * Derive the object field name from an IndexedDB index name.
   *
   * Convention used throughout the codebase:
   *   'by-target'   → 'targetId'
   *   'by-session'  → 'sessionId'
   *   'by-template' → 'templateId'
   *   'by-status'   → 'status'
   *   'by-platform' → 'platform'
   *   'by-kind'     → 'kind'
   *   'by-category' → 'category'
   *   'by-date'     → 'date'
   *   'by-severity' → 'severity'
   *   etc.
   *
   * Indexes that map to `<noun>Id` use the `-Id` suffix heuristic:
   * if the noun matches a known foreign-key pattern we append `Id`.
   */
  private static fieldForIndex(indexName: string): string {
    const raw = indexName.replace(/^by-/, '');
    const FK_FIELDS = new Set(['target', 'session', 'template', 'note']);
    if (FK_FIELDS.has(raw)) return `${raw}Id`;
    return raw;
  }

  private filterByField(fieldName: string, value: string | number): T[] {
    return Array.from(this.memory().values()).filter(
      (item) => (item as unknown as Record<string, unknown>)[fieldName] === value
    );
  }

  async getByIndex(indexName: string, value: string | number): Promise<T[]> {
    const db = await getHuntFlowDB();
    if (!db) return this.filterByField(BaseDB.fieldForIndex(indexName), value);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (await (db as any).getAllFromIndex(this.storeName, indexName, value)) as T[];
    } catch (error) {
      enableMemoryFallback(error);
      return this.filterByField(BaseDB.fieldForIndex(indexName), value);
    }
  }

  async clear(): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      this.memory().clear();
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).clear(this.storeName);
    } catch (error) {
      enableMemoryFallback(error);
      this.memory().clear();
    }
  }
}
