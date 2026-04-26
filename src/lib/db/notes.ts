import { enableMemoryFallback, getHuntFlowDB, getMemoryDB } from './index';
import type { Note } from './schema';

export class NoteDB {
  async init(): Promise<void> {
    await getHuntFlowDB();
  }

  async getAll(): Promise<Note[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().notes.values());

    try {
      return await db.getAll('notes');
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().notes.values());
    }
  }

  async getById(id: string): Promise<Note | undefined> {
    const db = await getHuntFlowDB();
    if (!db) return getMemoryDB().notes.get(id);

    try {
      return await db.get('notes', id);
    } catch (error) {
      enableMemoryFallback(error);
      return getMemoryDB().notes.get(id);
    }
  }

  async put(note: Note): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      getMemoryDB().notes.set(note.id, note);
      return;
    }

    try {
      await db.put('notes', note);
    } catch (error) {
      enableMemoryFallback(error);
      getMemoryDB().notes.set(note.id, note);
    }
  }

  async putBatch(notes: Note[]): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      for (const note of notes) getMemoryDB().notes.set(note.id, note);
      return;
    }

    try {
      const tx = db.transaction('notes', 'readwrite');
      await Promise.all([...notes.map((note) => tx.store.put(note)), tx.done]);
    } catch (error) {
      enableMemoryFallback(error);
      for (const note of notes) getMemoryDB().notes.set(note.id, note);
    }
  }

  async delete(id: string): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      getMemoryDB().notes.delete(id);
      for (const [assetId, asset] of getMemoryDB().evidenceAssets) {
        if (asset.noteId === id) {
          getMemoryDB().evidenceAssets.set(assetId, { ...asset, noteId: undefined, updatedAt: Date.now() });
        }
      }
      for (const [linkId, link] of getMemoryDB().evidenceLinks) {
        if (link.fromKey === `note:${id}` || link.toKey === `note:${id}`) getMemoryDB().evidenceLinks.delete(linkId);
      }
      return;
    }

    try {
      const tx = db.transaction(['notes', 'evidenceAssets', 'evidenceLinks'], 'readwrite');
      const assetsStore = tx.objectStore('evidenceAssets');
      const linksStore = tx.objectStore('evidenceLinks');
      const linkedAssets = await assetsStore.index('by-note').getAll(id);
      const links = [
        ...(await linksStore.index('by-from').getAll(`note:${id}`)),
        ...(await linksStore.index('by-to').getAll(`note:${id}`))
      ];

      await Promise.all([
        tx.objectStore('notes').delete(id),
        ...linkedAssets.map((asset) => assetsStore.put({ ...asset, noteId: undefined, updatedAt: Date.now() })),
        ...links.map((link) => linksStore.delete(link.id)),
        tx.done
      ]);
    } catch (error) {
      enableMemoryFallback(error);
      getMemoryDB().notes.delete(id);
    }
  }

  async getByTarget(targetId: string): Promise<Note[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().notes.values()).filter((n) => n.targetId === targetId);

    try {
      return await db.getAllFromIndex('notes', 'by-target', targetId);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().notes.values()).filter((n) => n.targetId === targetId);
    }
  }

  async getBySession(sessionId: string): Promise<Note[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().notes.values()).filter((n) => n.sessionId === sessionId);

    try {
      return await db.getAllFromIndex('notes', 'by-session', sessionId);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().notes.values()).filter((n) => n.sessionId === sessionId);
    }
  }

  async getByTemplate(templateId: string): Promise<Note[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().notes.values()).filter((n) => n.templateId === templateId);

    try {
      return await db.getAllFromIndex('notes', 'by-template', templateId);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().notes.values()).filter((n) => n.templateId === templateId);
    }
  }

  async getByTag(tag: string): Promise<Note[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().notes.values()).filter((n) => n.tags.includes(tag));

    try {
      return await db.getAllFromIndex('notes', 'by-tags', tag);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().notes.values()).filter((n) => n.tags.includes(tag));
    }
  }

  async getByUpdated(updatedAt: number): Promise<Note[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().notes.values()).filter((n) => n.updatedAt === updatedAt);

    try {
      return await db.getAllFromIndex('notes', 'by-updated', updatedAt);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().notes.values()).filter((n) => n.updatedAt === updatedAt);
    }
  }
}

export const noteDB = new NoteDB();
