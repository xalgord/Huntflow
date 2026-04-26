import { enableMemoryFallback, getHuntFlowDB, getMemoryDB } from './index';
import type { Payout, PayoutSeverity, PayoutStatus, Platform } from './schema';

export class PayoutDB {
  async init(): Promise<void> {
    await getHuntFlowDB();
  }

  async getAll(): Promise<Payout[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().payouts.values());

    try {
      return await db.getAll('payouts');
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().payouts.values());
    }
  }

  async getById(id: string): Promise<Payout | undefined> {
    const db = await getHuntFlowDB();
    if (!db) return getMemoryDB().payouts.get(id);

    try {
      return await db.get('payouts', id);
    } catch (error) {
      enableMemoryFallback(error);
      return getMemoryDB().payouts.get(id);
    }
  }

  async put(payout: Payout): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      getMemoryDB().payouts.set(payout.id, payout);
      return;
    }

    try {
      await db.put('payouts', payout);
    } catch (error) {
      enableMemoryFallback(error);
      getMemoryDB().payouts.set(payout.id, payout);
    }
  }

  async putBatch(payouts: Payout[]): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      for (const payout of payouts) getMemoryDB().payouts.set(payout.id, payout);
      return;
    }

    try {
      const tx = db.transaction('payouts', 'readwrite');
      await Promise.all([...payouts.map((payout) => tx.store.put(payout)), tx.done]);
    } catch (error) {
      enableMemoryFallback(error);
      for (const payout of payouts) getMemoryDB().payouts.set(payout.id, payout);
    }
  }

  async delete(id: string): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      getMemoryDB().payouts.delete(id);
      return;
    }

    try {
      await db.delete('payouts', id);
    } catch (error) {
      enableMemoryFallback(error);
      getMemoryDB().payouts.delete(id);
    }
  }

  async getByPlatform(platform: Platform): Promise<Payout[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().payouts.values()).filter((p) => p.platform === platform);

    try {
      return await db.getAllFromIndex('payouts', 'by-platform', platform);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().payouts.values()).filter((p) => p.platform === platform);
    }
  }

  async getBySeverity(severity: PayoutSeverity): Promise<Payout[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().payouts.values()).filter((p) => p.severity === severity);

    try {
      return await db.getAllFromIndex('payouts', 'by-severity', severity);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().payouts.values()).filter((p) => p.severity === severity);
    }
  }

  async getByStatus(status: PayoutStatus): Promise<Payout[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().payouts.values()).filter((p) => p.status === status);

    try {
      return await db.getAllFromIndex('payouts', 'by-status', status);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().payouts.values()).filter((p) => p.status === status);
    }
  }

  async getByDate(date: number): Promise<Payout[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().payouts.values()).filter((p) => p.date === date);

    try {
      return await db.getAllFromIndex('payouts', 'by-date', date);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().payouts.values()).filter((p) => p.date === date);
    }
  }
}

export const payoutDB = new PayoutDB();
