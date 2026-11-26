/**
 * Evidence files: bodies live in R2, an index row lives in D1.
 *
 *   PUT    /api/assets/:assetId   upload (Pro), streamed straight to R2
 *   GET    /api/assets/:assetId   download, streamed from R2
 *   DELETE /api/assets/:assetId   remove body + index row
 *
 * Limits match the previous backend: 100 MB per file, 1 GB per user.
 */
import type { AuthUser } from './auth';
import { requirePro } from './entitlements';
import { HttpError, json } from './http';

export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_STORAGE_BYTES = 1024 * 1024 * 1024;
const ASSET_ID_RE = /^[A-Za-z0-9._:-]{1,200}$/;

export function assetObjectKey(uid: string, assetId: string): string {
  return `evidence/${uid}/${assetId}`;
}

export function storageIdFor(assetId: string): string {
  return `r2:${assetId}`;
}

function requireAssetId(raw: string): string {
  let assetId: string;
  try {
    assetId = decodeURIComponent(raw);
  } catch {
    throw new HttpError(400, 'bad_asset_id', 'Invalid evidence id.');
  }
  if (!ASSET_ID_RE.test(assetId)) throw new HttpError(400, 'bad_asset_id', 'Invalid evidence id.');
  return assetId;
}

function headerText(request: Request, name: string, max: number): string | null {
  const raw = request.headers.get(name);
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    return decoded.slice(0, max) || null;
  } catch {
    return null;
  }
}

interface AssetRow {
  object_key: string;
  file_name: string | null;
  relative_path: string | null;
  mime_type: string;
  size: number;
  uploaded_at: number;
}

export async function handleAssetUpload(
  request: Request,
  rawAssetId: string,
  db: D1Database,
  bucket: R2Bucket,
  user: AuthUser
): Promise<Response> {
  const assetId = requireAssetId(rawAssetId);
  await requirePro(db, user);

  const declared = Number(request.headers.get('content-length') ?? '');
  if (!Number.isFinite(declared) || declared <= 0) {
    throw new HttpError(411, 'length_required', 'Evidence uploads need a Content-Length header.');
  }
  if (declared > MAX_FILE_BYTES) {
    throw new HttpError(413, 'file_too_large', 'Cloud sync supports evidence files up to 100MB.');
  }
  if (!request.body) throw new HttpError(400, 'empty_body', 'The evidence file is empty.');

  const used = await db
    .prepare('SELECT COALESCE(SUM(size), 0) AS used FROM asset_files WHERE uid = ?1 AND asset_id != ?2')
    .bind(user.uid, assetId)
    .first<{ used: number }>();
  const usedBytes = Number(used?.used ?? 0);
  if (usedBytes + declared > MAX_STORAGE_BYTES) {
    throw new HttpError(413, 'quota_exceeded', 'Cloud evidence storage quota is 1GB per user.');
  }

  const mimeType = (request.headers.get('content-type') || 'application/octet-stream').slice(0, 200);
  const fileName = headerText(request, 'x-hf-file-name', 500);
  const relativePath = headerText(request, 'x-hf-relative-path', 1000);
  const key = assetObjectKey(user.uid, assetId);

  const stored = await bucket.put(key, request.body, {
    httpMetadata: { contentType: mimeType },
    customMetadata: { uid: user.uid, assetId }
  });
  if (!stored) throw new HttpError(500, 'upload_failed', 'Evidence upload failed. Try again.');

  const uploadedAt = Date.now();
  await db
    .prepare(
      `INSERT INTO asset_files (uid, asset_id, object_key, file_name, relative_path, mime_type, size, uploaded_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
       ON CONFLICT (uid, asset_id) DO UPDATE SET
         object_key = excluded.object_key,
         file_name = excluded.file_name,
         relative_path = excluded.relative_path,
         mime_type = excluded.mime_type,
         size = excluded.size,
         uploaded_at = excluded.uploaded_at`
    )
    .bind(user.uid, assetId, key, fileName, relativePath, mimeType, stored.size, uploadedAt)
    .run();

  return json({ storageId: storageIdFor(assetId), size: stored.size, usedBytes: usedBytes + stored.size });
}

export async function handleAssetDownload(
  rawAssetId: string,
  db: D1Database,
  bucket: R2Bucket,
  user: AuthUser
): Promise<Response> {
  const assetId = requireAssetId(rawAssetId);
  const row = await db
    .prepare(
      `SELECT object_key, file_name, relative_path, mime_type, size, uploaded_at
       FROM asset_files WHERE uid = ?1 AND asset_id = ?2`
    )
    .bind(user.uid, assetId)
    .first<AssetRow>();
  if (!row) throw new HttpError(404, 'not_found', 'This evidence file is not in the cloud.');

  const object = await bucket.get(row.object_key);
  if (!object) throw new HttpError(404, 'not_found', 'This evidence file is not in the cloud.');

  const headers = new Headers({
    'content-type': row.mime_type || 'application/octet-stream',
    'content-length': String(object.size),
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
    'content-disposition': 'attachment',
    'x-hf-size': String(row.size),
    'x-hf-uploaded-at': String(row.uploaded_at)
  });
  if (row.file_name) headers.set('x-hf-file-name', encodeURIComponent(row.file_name));
  if (row.relative_path) headers.set('x-hf-relative-path', encodeURIComponent(row.relative_path));
  return new Response(object.body, { headers });
}

export async function handleAssetDelete(
  rawAssetId: string,
  db: D1Database,
  bucket: R2Bucket,
  user: AuthUser
): Promise<Response> {
  const assetId = requireAssetId(rawAssetId);
  const row = await db
    .prepare('SELECT object_key FROM asset_files WHERE uid = ?1 AND asset_id = ?2')
    .bind(user.uid, assetId)
    .first<{ object_key: string }>();
  if (!row) return json({ deleted: false });
  await bucket.delete(row.object_key);
  await db.prepare('DELETE FROM asset_files WHERE uid = ?1 AND asset_id = ?2').bind(user.uid, assetId).run();
  return json({ deleted: true });
}
