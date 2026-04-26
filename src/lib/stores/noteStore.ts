import { noteDB } from '$lib/db/notes';
import type { Note } from '$lib/types';
import { createPersistedArrayStore } from './persistedArrayStore';

export const noteStore = createPersistedArrayStore<Note>(noteDB, {
  sort: (a, b) => b.updatedAt - a.updatedAt
});

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
