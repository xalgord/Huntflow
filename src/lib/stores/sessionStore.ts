import { sessionDB } from '$lib/db/sessions';
import type { Session } from '$lib/types';
import { noteStore } from './noteStore';
import { createPersistedArrayStore } from './persistedArrayStore';

const baseSessionStore = createPersistedArrayStore<Session>(sessionDB, {
  sort: (a, b) => b.startedAt - a.startedAt
});

export const sessionStore = {
  ...baseSessionStore,
  async delete(id: string): Promise<void> {
    await baseSessionStore.delete(id);
    await baseSessionStore.persistNow();
    await noteStore.refresh();
  }
};

export async function getSessionsByTarget(targetId: string): Promise<Session[]> {
  await sessionStore.load();
  return sessionDB.getByTarget(targetId);
}

export async function getSessionsByStatus(status: Session['status']): Promise<Session[]> {
  await sessionStore.load();
  return sessionDB.getByStatus(status);
}
