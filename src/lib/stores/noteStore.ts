import { noteDB } from '$lib/db/notes';
import type { Note } from '$lib/types';
import { createPersistedArrayStore } from './persistedArrayStore';
import { evidenceAssetStore, evidenceLinkStore } from './evidenceStore';

const baseNoteStore = createPersistedArrayStore<Note>(noteDB, {
  sort: (a, b) => b.updatedAt - a.updatedAt
});

export const noteStore = {
  ...baseNoteStore,
  async delete(id: string): Promise<void> {
    await baseNoteStore.delete(id);
    await Promise.all([evidenceAssetStore.refresh(), evidenceLinkStore.refresh()]);
  }
};

export async function getNotesByTarget(targetId: string): Promise<Note[]> {
  await noteStore.load();
  return noteDB.getByTarget(targetId);
}

export async function getNotesBySession(sessionId: string): Promise<Note[]> {
  await noteStore.load();
  return noteDB.getBySession(sessionId);
}

export async function getNotesByTag(tag: string): Promise<Note[]> {
  await noteStore.load();
  return noteDB.getByTag(tag);
}

export async function getNotesByTemplate(templateId: string): Promise<Note[]> {
  await noteStore.load();
  return noteDB.getByTemplate(templateId);
}
