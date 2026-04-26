import { payoutDB } from '$lib/db/payouts';
import type { Payout, PayoutSeverity, PayoutStatus, Platform } from '$lib/types';
import { createPersistedArrayStore } from './persistedArrayStore';

export const payoutStore = createPersistedArrayStore<Payout>(payoutDB, {
  sort: (a, b) => b.date - a.date || b.updatedAt - a.updatedAt
});

export async function getPayoutsByPlatform(platform: Platform): Promise<Payout[]> {
  await payoutStore.load();
  return payoutDB.getByPlatform(platform);
}

export async function getPayoutsBySeverity(severity: PayoutSeverity): Promise<Payout[]> {
  await payoutStore.load();
  return payoutDB.getBySeverity(severity);
}

export async function getPayoutsByStatus(status: PayoutStatus): Promise<Payout[]> {
  await payoutStore.load();
  return payoutDB.getByStatus(status);
}
