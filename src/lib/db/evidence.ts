import { enableMemoryFallback, getHuntFlowDB, getMemoryDB } from './index';
import type {
  EvidenceAsset,
  EvidenceAssetKind,
  EvidenceBlob,
  EvidenceCanvasView,
  EvidenceLink,
  EvidenceNodeType,
  EvidenceRelationship,
  EvidenceSyncState
} from './schema';

export function evidenceNodeKey(type: EvidenceNodeType, id: string): string {
  return `${type}:${id}`;
}

function normalizeLink(link: EvidenceLink): EvidenceLink {
  return {
    ...link,
    fromKey: evidenceNodeKey(link.fromType, link.fromId),
    toKey: evidenceNodeKey(link.toType, link.toId)
  };
}

export class EvidenceAssetDB {
  async init(): Promise<void> {
    await getHuntFlowDB();
  }

  async getAll(): Promise<EvidenceAsset[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().evidenceAssets.values());

    try {
      return await db.getAll('evidenceAssets');
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().evidenceAssets.values());
    }
  }

  async getById(id: string): Promise<EvidenceAsset | undefined> {
    const db = await getHuntFlowDB();
    if (!db) return getMemoryDB().evidenceAssets.get(id);

    try {
      return await db.get('evidenceAssets', id);
    } catch (error) {
      enableMemoryFallback(error);
      return getMemoryDB().evidenceAssets.get(id);
    }
  }

  async put(asset: EvidenceAsset): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      getMemoryDB().evidenceAssets.set(asset.id, asset);
      return;
    }

    try {
      await db.put('evidenceAssets', asset);
    } catch (error) {
      enableMemoryFallback(error);
      getMemoryDB().evidenceAssets.set(asset.id, asset);
    }
  }

  async putBatch(assets: EvidenceAsset[]): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      for (const asset of assets) getMemoryDB().evidenceAssets.set(asset.id, asset);
      return;
    }

    try {
      const tx = db.transaction('evidenceAssets', 'readwrite');
      await Promise.all([...assets.map((asset) => tx.store.put(asset)), tx.done]);
    } catch (error) {
      enableMemoryFallback(error);
      for (const asset of assets) getMemoryDB().evidenceAssets.set(asset.id, asset);
    }
  }

  async delete(id: string): Promise<void> {
    const db = await getHuntFlowDB();
    const assetKey = evidenceNodeKey('asset', id);
    const urlKey = evidenceNodeKey('url', id);

    if (!db) {
      getMemoryDB().evidenceAssets.delete(id);
      getMemoryDB().evidenceBlobs.delete(id);
      for (const [linkId, link] of getMemoryDB().evidenceLinks) {
        if ([assetKey, urlKey].includes(link.fromKey) || [assetKey, urlKey].includes(link.toKey)) {
          getMemoryDB().evidenceLinks.delete(linkId);
        }
      }
      return;
    }

    try {
      const tx = db.transaction(['evidenceAssets', 'evidenceBlobs', 'evidenceLinks'], 'readwrite');
      const linksStore = tx.objectStore('evidenceLinks');
      const outgoingAsset = await linksStore.index('by-from').getAll(assetKey);
      const incomingAsset = await linksStore.index('by-to').getAll(assetKey);
      const outgoingUrl = await linksStore.index('by-from').getAll(urlKey);
      const incomingUrl = await linksStore.index('by-to').getAll(urlKey);

      await Promise.all([
        tx.objectStore('evidenceAssets').delete(id),
        tx.objectStore('evidenceBlobs').delete(id),
        ...[...outgoingAsset, ...incomingAsset, ...outgoingUrl, ...incomingUrl].map((link) =>
          linksStore.delete(link.id)
        ),
        tx.done
      ]);
    } catch (error) {
      enableMemoryFallback(error);
      getMemoryDB().evidenceAssets.delete(id);
      getMemoryDB().evidenceBlobs.delete(id);
    }
  }

  async getByTarget(targetId: string): Promise<EvidenceAsset[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().evidenceAssets.values()).filter((asset) => asset.targetId === targetId);

    try {
      return await db.getAllFromIndex('evidenceAssets', 'by-target', targetId);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().evidenceAssets.values()).filter((asset) => asset.targetId === targetId);
    }
  }

  async getBySession(sessionId: string): Promise<EvidenceAsset[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().evidenceAssets.values()).filter((asset) => asset.sessionId === sessionId);

    try {
      return await db.getAllFromIndex('evidenceAssets', 'by-session', sessionId);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().evidenceAssets.values()).filter((asset) => asset.sessionId === sessionId);
    }
  }

  async getByNote(noteId: string): Promise<EvidenceAsset[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().evidenceAssets.values()).filter((asset) => asset.noteId === noteId);

    try {
      return await db.getAllFromIndex('evidenceAssets', 'by-note', noteId);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().evidenceAssets.values()).filter((asset) => asset.noteId === noteId);
    }
  }

  async getByKind(kind: EvidenceAssetKind): Promise<EvidenceAsset[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().evidenceAssets.values()).filter((asset) => asset.kind === kind);

    try {
      return await db.getAllFromIndex('evidenceAssets', 'by-kind', kind);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().evidenceAssets.values()).filter((asset) => asset.kind === kind);
    }
  }

  async getByTag(tag: string): Promise<EvidenceAsset[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().evidenceAssets.values()).filter((asset) => asset.tags.includes(tag));

    try {
      return await db.getAllFromIndex('evidenceAssets', 'by-tags', tag);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().evidenceAssets.values()).filter((asset) => asset.tags.includes(tag));
    }
  }

  async getBySyncState(syncState: EvidenceSyncState): Promise<EvidenceAsset[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().evidenceAssets.values()).filter((asset) => asset.syncState === syncState);

    try {
      return await db.getAllFromIndex('evidenceAssets', 'by-sync-state', syncState);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().evidenceAssets.values()).filter((asset) => asset.syncState === syncState);
    }
  }
}

export class EvidenceBlobDB {
  /**
   * Coerce an incoming blob row to the canonical shape: `blob` is the
   * binary, `data` (legacy) is dropped. This handles three cases:
   *   - already-canonical rows: pass-through.
   *   - legacy rows with only `data`: surface it as `blob`.
   *   - rows from older code paths that accidentally wrote both: prefer
   *     `blob` and drop `data`.
   * Centralizing this here means readers never have to remember to
   * fall back to `data` themselves.
   */
  private normalize(row: EvidenceBlob | undefined): EvidenceBlob | undefined {
    if (!row) return undefined;
    // Use a structural cast: rows pulled from IDB may carry the legacy
    // `data` alias even though the type system no longer advertises it.
    const candidate = (row as { blob?: Blob; data?: Blob }).blob ?? (row as { data?: Blob }).data;
    if (!candidate) return undefined;
    const cloned: Record<string, unknown> = { ...(row as unknown as Record<string, unknown>) };
    delete cloned.data;
    cloned.blob = candidate;
    return cloned as unknown as EvidenceBlob;
  }

  private prepare(blob: EvidenceBlob): EvidenceBlob {
    // Same idea on write: refuse to persist the deprecated alias even
    // if a caller hands it to us. The canonical row never carries
    // `data`, period.
    const candidate = (blob as { blob?: Blob; data?: Blob }).blob ?? (blob as { data?: Blob }).data;
    if (!candidate) {
      throw new Error('EvidenceBlob requires a `blob` payload.');
    }
    const cloned: Record<string, unknown> = { ...(blob as unknown as Record<string, unknown>) };
    delete cloned.data;
    cloned.blob = candidate;
    return cloned as unknown as EvidenceBlob;
  }

  async get(assetId: string): Promise<EvidenceBlob | undefined> {
    const db = await getHuntFlowDB();
    if (!db) return this.normalize(getMemoryDB().evidenceBlobs.get(assetId));

    try {
      const row = await db.get('evidenceBlobs', assetId);
      return this.normalize(row);
    } catch (error) {
      enableMemoryFallback(error);
      return this.normalize(getMemoryDB().evidenceBlobs.get(assetId));
    }
  }

  async getAll(): Promise<EvidenceBlob[]> {
    const db = await getHuntFlowDB();
    if (!db) {
      return Array.from(getMemoryDB().evidenceBlobs.values())
        .map((row) => this.normalize(row))
        .filter((row): row is EvidenceBlob => Boolean(row));
    }

    try {
      const rows = await db.getAll('evidenceBlobs');
      return rows
        .map((row) => this.normalize(row))
        .filter((row): row is EvidenceBlob => Boolean(row));
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().evidenceBlobs.values())
        .map((row) => this.normalize(row))
        .filter((row): row is EvidenceBlob => Boolean(row));
    }
  }

  async put(blob: EvidenceBlob): Promise<void> {
    const normalized = this.prepare(blob);
    const db = await getHuntFlowDB();
    if (!db) {
      getMemoryDB().evidenceBlobs.set(normalized.assetId, normalized);
      return;
    }

    try {
      await db.put('evidenceBlobs', normalized);
    } catch (error) {
      enableMemoryFallback(error);
      getMemoryDB().evidenceBlobs.set(normalized.assetId, normalized);
    }
  }

  async putBatch(blobs: EvidenceBlob[]): Promise<void> {
    const normalized = blobs.map((row) => this.prepare(row));
    const db = await getHuntFlowDB();
    if (!db) {
      for (const blob of normalized) getMemoryDB().evidenceBlobs.set(blob.assetId, blob);
      return;
    }

    try {
      const tx = db.transaction('evidenceBlobs', 'readwrite');
      await Promise.all([...normalized.map((blob) => tx.store.put(blob)), tx.done]);
    } catch (error) {
      enableMemoryFallback(error);
      for (const blob of normalized) getMemoryDB().evidenceBlobs.set(blob.assetId, blob);
    }
  }

  async delete(assetId: string): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      getMemoryDB().evidenceBlobs.delete(assetId);
      return;
    }

    try {
      await db.delete('evidenceBlobs', assetId);
    } catch (error) {
      enableMemoryFallback(error);
      getMemoryDB().evidenceBlobs.delete(assetId);
    }
  }
}

export class EvidenceLinkDB {
  async getAll(): Promise<EvidenceLink[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().evidenceLinks.values());

    try {
      return await db.getAll('evidenceLinks');
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().evidenceLinks.values());
    }
  }

  async getById(id: string): Promise<EvidenceLink | undefined> {
    const db = await getHuntFlowDB();
    if (!db) return getMemoryDB().evidenceLinks.get(id);

    try {
      return await db.get('evidenceLinks', id);
    } catch (error) {
      enableMemoryFallback(error);
      return getMemoryDB().evidenceLinks.get(id);
    }
  }

  async put(link: EvidenceLink): Promise<void> {
    const normalized = normalizeLink(link);
    const db = await getHuntFlowDB();
    if (!db) {
      getMemoryDB().evidenceLinks.set(normalized.id, normalized);
      return;
    }

    try {
      await db.put('evidenceLinks', normalized);
    } catch (error) {
      enableMemoryFallback(error);
      getMemoryDB().evidenceLinks.set(normalized.id, normalized);
    }
  }

  async putBatch(links: EvidenceLink[]): Promise<void> {
    const normalized = links.map(normalizeLink);
    const db = await getHuntFlowDB();
    if (!db) {
      for (const link of normalized) getMemoryDB().evidenceLinks.set(link.id, link);
      return;
    }

    try {
      const tx = db.transaction('evidenceLinks', 'readwrite');
      await Promise.all([...normalized.map((link) => tx.store.put(link)), tx.done]);
    } catch (error) {
      enableMemoryFallback(error);
      for (const link of normalized) getMemoryDB().evidenceLinks.set(link.id, link);
    }
  }

  async delete(id: string): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      getMemoryDB().evidenceLinks.delete(id);
      return;
    }

    try {
      await db.delete('evidenceLinks', id);
    } catch (error) {
      enableMemoryFallback(error);
      getMemoryDB().evidenceLinks.delete(id);
    }
  }

  async getByNode(type: EvidenceNodeType, id: string): Promise<EvidenceLink[]> {
    const key = evidenceNodeKey(type, id);
    const db = await getHuntFlowDB();
    if (!db) {
      return Array.from(getMemoryDB().evidenceLinks.values()).filter(
        (link) => link.fromKey === key || link.toKey === key
      );
    }

    try {
      const tx = db.transaction('evidenceLinks', 'readonly');
      const store = tx.objectStore('evidenceLinks');
      const [from, to] = await Promise.all([
        store.index('by-from').getAll(key),
        store.index('by-to').getAll(key),
        tx.done
      ]);
      const unique = new Map([...from, ...to].map((link) => [link.id, link]));
      return Array.from(unique.values());
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().evidenceLinks.values()).filter(
        (link) => link.fromKey === key || link.toKey === key
      );
    }
  }

  async getByRelationship(relationship: EvidenceRelationship): Promise<EvidenceLink[]> {
    const db = await getHuntFlowDB();
    if (!db) {
      return Array.from(getMemoryDB().evidenceLinks.values()).filter((link) => link.relationship === relationship);
    }

    try {
      return await db.getAllFromIndex('evidenceLinks', 'by-relationship', relationship);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().evidenceLinks.values()).filter((link) => link.relationship === relationship);
    }
  }
}

export class EvidenceCanvasViewDB {
  async getAll(): Promise<EvidenceCanvasView[]> {
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().evidenceCanvasViews.values());

    try {
      return await db.getAll('evidenceCanvasViews');
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().evidenceCanvasViews.values());
    }
  }

  async getById(id: string): Promise<EvidenceCanvasView | undefined> {
    const db = await getHuntFlowDB();
    if (!db) return getMemoryDB().evidenceCanvasViews.get(id);

    try {
      return await db.get('evidenceCanvasViews', id);
    } catch (error) {
      enableMemoryFallback(error);
      return getMemoryDB().evidenceCanvasViews.get(id);
    }
  }

  async put(view: EvidenceCanvasView): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      getMemoryDB().evidenceCanvasViews.set(view.id, view);
      return;
    }

    try {
      await db.put('evidenceCanvasViews', view);
    } catch (error) {
      enableMemoryFallback(error);
      getMemoryDB().evidenceCanvasViews.set(view.id, view);
    }
  }

  async putBatch(views: EvidenceCanvasView[]): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      for (const view of views) getMemoryDB().evidenceCanvasViews.set(view.id, view);
      return;
    }

    try {
      const tx = db.transaction('evidenceCanvasViews', 'readwrite');
      await Promise.all([...views.map((view) => tx.store.put(view)), tx.done]);
    } catch (error) {
      enableMemoryFallback(error);
      for (const view of views) getMemoryDB().evidenceCanvasViews.set(view.id, view);
    }
  }

  async delete(id: string): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      getMemoryDB().evidenceCanvasViews.delete(id);
      return;
    }

    try {
      await db.delete('evidenceCanvasViews', id);
    } catch (error) {
      enableMemoryFallback(error);
      getMemoryDB().evidenceCanvasViews.delete(id);
    }
  }

  async getByTarget(targetId: string): Promise<EvidenceCanvasView[]> {
    const db = await getHuntFlowDB();
    if (!db) {
      return Array.from(getMemoryDB().evidenceCanvasViews.values()).filter((view) => view.targetId === targetId);
    }

    try {
      return await db.getAllFromIndex('evidenceCanvasViews', 'by-target', targetId);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().evidenceCanvasViews.values()).filter((view) => view.targetId === targetId);
    }
  }
}

export const evidenceAssetDB = new EvidenceAssetDB();
export const evidenceBlobDB = new EvidenceBlobDB();
export const evidenceLinkDB = new EvidenceLinkDB();
export const evidenceCanvasViewDB = new EvidenceCanvasViewDB();
