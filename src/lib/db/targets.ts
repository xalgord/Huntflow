import { enableMemoryFallback, getHuntFlowDB, getMemoryDB } from './index';
import type { Platform, Priority, Target, TargetStatus } from './schema';

export class TargetDB {
  async init(): Promise<void> {
    await getHuntFlowDB();
  }

  async getAll(): Promise<Target[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().targets.values());

    try {
      return await db.getAll('targets');
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().targets.values());
    }
  }

  async getById(id: string): Promise<Target | undefined> {
    const db = await getHuntFlowDB();
    if (!db) return getMemoryDB().targets.get(id);

    try {
      return await db.get('targets', id);
    } catch (error) {
      enableMemoryFallback(error);
      return getMemoryDB().targets.get(id);
    }
  }

  async put(target: Target): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      getMemoryDB().targets.set(target.id, target);
      return;
    }

    try {
      await db.put('targets', target);
    } catch (error) {
      enableMemoryFallback(error);
      getMemoryDB().targets.set(target.id, target);
    }
  }

  async putBatch(targets: Target[]): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      for (const target of targets) getMemoryDB().targets.set(target.id, target);
      return;
    }

    try {
      const tx = db.transaction('targets', 'readwrite');
      await Promise.all([...targets.map((target) => tx.store.put(target)), tx.done]);
    } catch (error) {
      enableMemoryFallback(error);
      for (const target of targets) getMemoryDB().targets.set(target.id, target);
    }
  }

  async delete(id: string): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      getMemoryDB().targets.delete(id);
      for (const [sessionId, session] of getMemoryDB().sessions) {
        if (session.targetId === id) getMemoryDB().sessions.delete(sessionId);
      }
      for (const [noteId, note] of getMemoryDB().notes) {
        if (note.targetId === id) getMemoryDB().notes.delete(noteId);
      }
      return;
    }

    try {
      const tx = db.transaction(['targets', 'sessions', 'notes'], 'readwrite');
      const sessionsStore = tx.objectStore('sessions');
      const notesStore = tx.objectStore('notes');
      const sessions = await sessionsStore.index('by-target').getAll(id);
      const notes = await notesStore.index('by-target').getAll(id);

      await Promise.all([
        tx.objectStore('targets').delete(id),
        ...sessions.map((session) => sessionsStore.delete(session.id)),
        ...notes.map((note) => notesStore.delete(note.id)),
        tx.done
      ]);
    } catch (error) {
      enableMemoryFallback(error);
      getMemoryDB().targets.delete(id);
    }
  }

  async getByPlatform(platform: Platform): Promise<Target[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().targets.values()).filter((t) => t.platform === platform);

    try {
      return await db.getAllFromIndex('targets', 'by-platform', platform);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().targets.values()).filter((t) => t.platform === platform);
    }
  }

  async getByStatus(status: TargetStatus): Promise<Target[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().targets.values()).filter((t) => t.status === status);

    try {
      return await db.getAllFromIndex('targets', 'by-status', status);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().targets.values()).filter((t) => t.status === status);
    }
  }

  async getByPriority(priority: Priority): Promise<Target[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().targets.values()).filter((t) => t.priority === priority);

    try {
      return await db.getAllFromIndex('targets', 'by-priority', priority);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().targets.values()).filter((t) => t.priority === priority);
    }
  }

  async getByUpdated(updatedAt: number): Promise<Target[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().targets.values()).filter((t) => t.updatedAt === updatedAt);

    try {
      return await db.getAllFromIndex('targets', 'by-updated', updatedAt);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().targets.values()).filter((t) => t.updatedAt === updatedAt);
    }
  }
}

export const targetDB = new TargetDB();
