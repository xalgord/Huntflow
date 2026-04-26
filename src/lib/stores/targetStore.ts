import { targetDB } from '$lib/db/targets';
import type { Platform, Priority, Target, TargetStatus } from '$lib/types';
import { noteStore } from './noteStore';
import { createPersistedArrayStore } from './persistedArrayStore';
import { sessionStore } from './sessionStore';

const baseTargetStore = createPersistedArrayStore<Target>(targetDB, {
  sort: (a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return (b.lastSessionAt ?? b.updatedAt) - (a.lastSessionAt ?? a.updatedAt);
  }
});

export const targetStore = {
  ...baseTargetStore,
  async delete(id: string): Promise<void> {
    await baseTargetStore.delete(id);
    await baseTargetStore.persistNow();
    await Promise.all([sessionStore.refresh(), noteStore.refresh()]);
  }
};

export async function getTargetsByPlatform(platform: Platform): Promise<Target[]> {
  await targetStore.load();
  return targetDB.getByPlatform(platform);
}

export async function getTargetsByPriority(priority: Priority): Promise<Target[]> {
  await targetStore.load();
  return targetDB.getByPriority(priority);
}

export async function getTargetsByStatus(status: TargetStatus): Promise<Target[]> {
  await targetStore.load();
  return targetDB.getByStatus(status);
}
