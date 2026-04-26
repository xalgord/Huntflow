import {
  evidenceAssetDB,
  evidenceBlobDB,
  evidenceCanvasViewDB,
  evidenceLinkDB
} from '$lib/db/evidence';
import type {
  EvidenceAsset,
  EvidenceAssetKind,
  EvidenceBlob,
  EvidenceCanvasView,
  EvidenceLink,
  EvidenceNodeType,
  EvidenceRelationship,
  EvidenceSyncState
} from '$lib/types';
import { createPersistedArrayStore } from './persistedArrayStore';

const baseEvidenceAssetStore = createPersistedArrayStore<EvidenceAsset>(evidenceAssetDB, {
  sort: (a, b) => b.updatedAt - a.updatedAt
});

const baseEvidenceLinkStore = createPersistedArrayStore<EvidenceLink>(evidenceLinkDB, {
  sort: (a, b) => b.updatedAt - a.updatedAt
});

const baseEvidenceCanvasViewStore = createPersistedArrayStore<EvidenceCanvasView>(evidenceCanvasViewDB, {
  sort: (a, b) => b.updatedAt - a.updatedAt
});

export const evidenceAssetStore = {
  ...baseEvidenceAssetStore,
  async delete(id: string): Promise<void> {
    await evidenceAssetDB.delete(id);
    await Promise.all([baseEvidenceAssetStore.refresh(), baseEvidenceLinkStore.refresh()]);
  },
  async persistNow(): Promise<void> {
    await baseEvidenceAssetStore.persistNow();
  }
};

export const evidenceLinkStore = {
  ...baseEvidenceLinkStore,
  async persistNow(): Promise<void> {
    await baseEvidenceLinkStore.persistNow();
  }
};

export const evidenceCanvasViewStore = {
  ...baseEvidenceCanvasViewStore,
  async persistNow(): Promise<void> {
    await baseEvidenceCanvasViewStore.persistNow();
  }
};

export async function putEvidenceBlob(blob: EvidenceBlob): Promise<void> {
  await evidenceBlobDB.put(blob);
}

export async function getEvidenceBlob(assetId: string): Promise<EvidenceBlob | undefined> {
  return evidenceBlobDB.get(assetId);
}

export async function deleteEvidenceBlob(assetId: string): Promise<void> {
  await evidenceBlobDB.delete(assetId);
}

export async function getEvidenceAssetsByTarget(targetId: string): Promise<EvidenceAsset[]> {
  return evidenceAssetDB.getByTarget(targetId);
}

export async function getEvidenceAssetsBySession(sessionId: string): Promise<EvidenceAsset[]> {
  return evidenceAssetDB.getBySession(sessionId);
}

export async function getEvidenceAssetsByNote(noteId: string): Promise<EvidenceAsset[]> {
  return evidenceAssetDB.getByNote(noteId);
}

export async function getEvidenceAssetsByKind(kind: EvidenceAssetKind): Promise<EvidenceAsset[]> {
  return evidenceAssetDB.getByKind(kind);
}

export async function getEvidenceAssetsByTag(tag: string): Promise<EvidenceAsset[]> {
  return evidenceAssetDB.getByTag(tag);
}

export async function getEvidenceAssetsBySyncState(syncState: EvidenceSyncState): Promise<EvidenceAsset[]> {
  return evidenceAssetDB.getBySyncState(syncState);
}

export async function getEvidenceLinksByNode(type: EvidenceNodeType, id: string): Promise<EvidenceLink[]> {
  return evidenceLinkDB.getByNode(type, id);
}

export async function getEvidenceLinksByRelationship(
  relationship: EvidenceRelationship
): Promise<EvidenceLink[]> {
  return evidenceLinkDB.getByRelationship(relationship);
}
