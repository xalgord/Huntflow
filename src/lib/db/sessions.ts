import { enableMemoryFallback, getHuntFlowDB, getMemoryDB } from './index';
import type { Session } from './schema';

export class SessionDB {
  async init(): Promise<void> {
    await getHuntFlowDB();
  }

  async getAll(): Promise<Session[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().sessions.values());

    try {
      return await db.getAll('sessions');
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().sessions.values());
    }
  }

  async getById(id: string): Promise<Session | undefined> {
    const db = await getHuntFlowDB();
    if (!db) return getMemoryDB().sessions.get(id);

    try {
      return await db.get('sessions', id);
    } catch (error) {
      enableMemoryFallback(error);
      return getMemoryDB().sessions.get(id);
    }
  }

  async put(session: Session): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      getMemoryDB().sessions.set(session.id, session);
      return;
    }

    try {
      await db.put('sessions', session);
    } catch (error) {
      enableMemoryFallback(error);
      getMemoryDB().sessions.set(session.id, session);
    }
  }

  async putBatch(sessions: Session[]): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      for (const session of sessions) getMemoryDB().sessions.set(session.id, session);
      return;
    }

    try {
      const tx = db.transaction('sessions', 'readwrite');
      await Promise.all([...sessions.map((session) => tx.store.put(session)), tx.done]);
    } catch (error) {
      enableMemoryFallback(error);
      for (const session of sessions) getMemoryDB().sessions.set(session.id, session);
    }
  }

  async delete(id: string): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      getMemoryDB().sessions.delete(id);
      for (const [noteId, note] of getMemoryDB().notes) {
        if (note.sessionId === id) {
          const next = { ...note };
          delete next.sessionId;
          getMemoryDB().notes.set(noteId, next);
        }
      }
      for (const [assetId, asset] of getMemoryDB().evidenceAssets) {
        if (asset.sessionId === id) {
          getMemoryDB().evidenceAssets.set(assetId, { ...asset, sessionId: undefined, updatedAt: Date.now() });
        }
      }
      for (const [linkId, link] of getMemoryDB().evidenceLinks) {
        if (link.fromKey === `session:${id}` || link.toKey === `session:${id}`) {
          getMemoryDB().evidenceLinks.delete(linkId);
        }
      }
      return;
    }

    try {
      const tx = db.transaction(['sessions', 'notes', 'evidenceAssets', 'evidenceLinks'], 'readwrite');
      const notesStore = tx.objectStore('notes');
      const assetsStore = tx.objectStore('evidenceAssets');
      const linksStore = tx.objectStore('evidenceLinks');
      const linkedNotes = await notesStore.index('by-session').getAll(id);
      const linkedAssets = await assetsStore.index('by-session').getAll(id);
      const links = [
        ...(await linksStore.index('by-from').getAll(`session:${id}`)),
        ...(await linksStore.index('by-to').getAll(`session:${id}`))
      ];

      await Promise.all([
        tx.objectStore('sessions').delete(id),
        ...linkedNotes.map((note) => {
          const next = { ...note };
          delete next.sessionId;
          return notesStore.put(next);
        }),
        ...linkedAssets.map((asset) => assetsStore.put({ ...asset, sessionId: undefined, updatedAt: Date.now() })),
        ...links.map((link) => linksStore.delete(link.id)),
        tx.done
      ]);
    } catch (error) {
      enableMemoryFallback(error);
      getMemoryDB().sessions.delete(id);
    }
  }

  async getByTarget(targetId: string): Promise<Session[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().sessions.values()).filter((s) => s.targetId === targetId);

    try {
      return await db.getAllFromIndex('sessions', 'by-target', targetId);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().sessions.values()).filter((s) => s.targetId === targetId);
    }
  }

  async getByStarted(startedAt: number): Promise<Session[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().sessions.values()).filter((s) => s.startedAt === startedAt);

    try {
      return await db.getAllFromIndex('sessions', 'by-started', startedAt);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().sessions.values()).filter((s) => s.startedAt === startedAt);
    }
  }

  async getByStatus(status: Session['status']): Promise<Session[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().sessions.values()).filter((s) => s.status === status);

    try {
      return await db.getAllFromIndex('sessions', 'by-status', status);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().sessions.values()).filter((s) => s.status === status);
    }
  }
}

export const sessionDB = new SessionDB();
