import { evidenceBlobDB } from '$lib/db/evidence';
import type { EvidenceAsset, EvidenceBlob } from '$lib/types';
import { cloudEvidenceQuotaError } from '$lib/utils/evidence';
import { isRecord } from '$lib/utils/guards';
import { cloudApi, cloudConfigured, getConvexClient } from './convex';

interface UploadResponse {
  storageId?: string;
}

interface RemoteAssetFile {
  url: string;
  storageId: string;
  fileName?: string;
  relativePath?: string;
  mimeType: string;
  size: number;
  uploadedAt: number;
}



function normalizeRemoteAssetFile(value: unknown): RemoteAssetFile | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.url !== 'string' ||
    typeof value.storageId !== 'string' ||
    typeof value.mimeType !== 'string' ||
    typeof value.size !== 'number' ||
    typeof value.uploadedAt !== 'number'
  ) {
    return null;
  }

  return {
    url: value.url,
    storageId: value.storageId,
    fileName: typeof value.fileName === 'string' ? value.fileName : undefined,
    relativePath: typeof value.relativePath === 'string' ? value.relativePath : undefined,
    mimeType: value.mimeType,
    size: value.size,
    uploadedAt: value.uploadedAt
  };
}

export async function uploadEvidenceAssetFile(
  asset: EvidenceAsset,
  evidenceBlob: EvidenceBlob,
  currentSyncedBytes: number
): Promise<string> {
  if (!cloudConfigured) throw new Error('Missing VITE_CONVEX_URL.');
  if (asset.source === 'url') throw new Error('URL assets do not have uploadable file content.');
  const quotaError = cloudEvidenceQuotaError(evidenceBlob.size, currentSyncedBytes);
  if (quotaError) throw new Error(quotaError);

  const convex = getConvexClient();
  if (!convex) throw new Error('Convex is not available in this browser.');

  const uploadUrl = await convex.mutation(cloudApi.generateAssetUploadUrl, {});
  if (typeof uploadUrl !== 'string') throw new Error('Convex did not return an upload URL.');

  let upload: Response | undefined;
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      upload = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': evidenceBlob.mimeType || asset.mimeType || 'application/octet-stream' },
        body: evidenceBlob.blob
      });
      if (upload.ok) break;
    } catch (networkError) {
      if (attempt === MAX_RETRIES) throw networkError;
    }
    // Exponential backoff: 500ms, 1s, 2s
    if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
  }

  if (!upload || !upload.ok) throw new Error(`Evidence upload failed after ${MAX_RETRIES} attempts.`);

  const result = (await upload.json()) as UploadResponse;
  if (!result.storageId) throw new Error('Evidence upload did not return a storage ID.');

  await convex.mutation(cloudApi.registerAssetFile, {
    assetId: asset.id,
    storageId: result.storageId,
    fileName: evidenceBlob.fileName ?? asset.fileName,
    relativePath: evidenceBlob.relativePath ?? asset.relativePath,
    mimeType: evidenceBlob.mimeType || asset.mimeType || 'application/octet-stream',
    size: evidenceBlob.size,
    uploadedAt: Date.now()
  });

  return result.storageId;
}

export async function getRemoteEvidenceAssetFile(assetId: string): Promise<RemoteAssetFile | null> {
  if (!cloudConfigured) return null;
  const convex = getConvexClient();
  if (!convex) return null;
  const result = await convex.query(cloudApi.getAssetFileUrl, { assetId });
  return normalizeRemoteAssetFile(result);
}

export async function cacheRemoteEvidenceAsset(asset: EvidenceAsset): Promise<EvidenceBlob | null> {
  const existing = await evidenceBlobDB.get(asset.id);
  if (existing) return existing;

  const remote = await getRemoteEvidenceAssetFile(asset.id);
  if (!remote) return null;

  const response = await fetch(remote.url);
  if (!response.ok) throw new Error(`Evidence download failed with HTTP ${response.status}.`);
  const blob = await response.blob();
  const cached: EvidenceBlob = {
    assetId: asset.id,
    blob,
    fileName: remote.fileName ?? asset.fileName,
    relativePath: remote.relativePath ?? asset.relativePath,
    mimeType: remote.mimeType || asset.mimeType,
    size: remote.size || blob.size,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  await evidenceBlobDB.put(cached);
  return cached;
}

export async function deleteRemoteEvidenceAssetFile(assetId: string): Promise<void> {
  if (!cloudConfigured) return;
  const convex = getConvexClient();
  if (!convex) return;
  await convex.mutation(cloudApi.deleteAssetFile, { assetId });
}
