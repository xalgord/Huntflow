import { evidenceBlobDB } from '$lib/db/evidence';
import type { EvidenceAsset, EvidenceBlob } from '$lib/types';
import { cloudEvidenceQuotaError } from '$lib/utils/evidence';
import { CloudApiError, cloudConfigured, cloudFetch } from './api';

/**
 * Evidence file transfer for cloud sync. Files stream through
 * `/api/assets/:assetId` into R2; the asset record itself syncs like
 * any other item and carries the returned `storageId`.
 */

const MAX_ATTEMPTS = 3;

function assetPath(assetId: string): string {
  return `/assets/${encodeURIComponent(assetId)}`;
}

function decodeHeader(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value) || undefined;
  } catch {
    return undefined;
  }
}

export async function uploadEvidenceAssetFile(
  asset: EvidenceAsset,
  evidenceBlob: EvidenceBlob,
  currentSyncedBytes: number
): Promise<string> {
  if (!cloudConfigured) throw new Error('Cloud sync is not configured for this build.');
  if (asset.source === 'url') throw new Error('URL assets do not have uploadable file content.');
  const quotaError = cloudEvidenceQuotaError(evidenceBlob.size, currentSyncedBytes);
  if (quotaError) throw new Error(quotaError);

  const headers: Record<string, string> = {
    'content-type': evidenceBlob.mimeType || asset.mimeType || 'application/octet-stream'
  };
  const fileName = evidenceBlob.fileName ?? asset.fileName;
  const relativePath = evidenceBlob.relativePath ?? asset.relativePath;
  if (fileName) headers['x-hf-file-name'] = encodeURIComponent(fileName);
  if (relativePath) headers['x-hf-relative-path'] = encodeURIComponent(relativePath);

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await cloudFetch(assetPath(asset.id), { method: 'PUT', headers, body: evidenceBlob.blob });
      const result = (await response.json()) as { storageId?: unknown };
      if (typeof result.storageId !== 'string' || !result.storageId) {
        throw new Error('Evidence upload did not return a storage ID.');
      }
      return result.storageId;
    } catch (error) {
      lastError = error;
      // Client errors (quota, size, Pro) won't improve on retry.
      if (error instanceof CloudApiError && error.status >= 400 && error.status < 500) break;
      if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error(`Evidence upload failed after ${MAX_ATTEMPTS} attempts.`);
}

export async function cacheRemoteEvidenceAsset(asset: EvidenceAsset): Promise<EvidenceBlob | null> {
  const existing = await evidenceBlobDB.get(asset.id);
  if (existing) return existing;
  if (!cloudConfigured) return null;

  let response: Response;
  try {
    response = await cloudFetch(assetPath(asset.id));
  } catch (error) {
    if (error instanceof CloudApiError && error.status === 404) return null;
    throw error;
  }

  const blob = await response.blob();
  const cached: EvidenceBlob = {
    assetId: asset.id,
    blob,
    fileName: decodeHeader(response.headers.get('x-hf-file-name')) ?? asset.fileName,
    relativePath: decodeHeader(response.headers.get('x-hf-relative-path')) ?? asset.relativePath,
    mimeType: response.headers.get('content-type') || asset.mimeType,
    size: blob.size,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  await evidenceBlobDB.put(cached);
  return cached;
}

export async function deleteRemoteEvidenceAssetFile(assetId: string): Promise<void> {
  if (!cloudConfigured) return;
  await cloudFetch(assetPath(assetId), { method: 'DELETE' });
}
