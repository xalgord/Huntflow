/**
 * Cloud sync: a per-user, last-writer-wins key/value log in D1.
 *
 * Wire format
 * -----------
 * Push (POST /api/sync/push) sends `payload` as a JSON *string* so the
 * Function never has to parse or re-serialise record bodies — D1
 * validates them (`json_valid`, `payload.id === localId`) inside the
 * upsert. Pull (GET /api/sync/changes) returns `payload` as a JSON
 * object, spliced into the response text straight from storage.
 *
 * Change feed
 * -----------
 * Every push bumps the user's `sync_state.seq` and stamps the rows it
 * actually changed with that value. A device keeps a cursor
 * `<seq>.<rowid>` and asks for rows after it, in (seq, rowid) order,
 * one bounded page at a time. Rows that lose last-writer-wins are left
 * untouched, so re-pushing an unchanged snapshot never wakes other
 * devices.
 */
import type { AuthUser } from './auth';
import { requirePro } from './entitlements';
import { HttpError, isRecord, json, rawJson, readJson } from './http';

export const SYNC_COLLECTIONS = new Set([
  'sessions',
  'notes',
  'targets',
  'payouts',
  'evidenceAssets',
  'evidenceLinks',
  'evidenceCanvasViews',
  'reconAssets',
  'payloads',
  'checklistTemplates',
  'checklistInstances',
  'submissions',
  'bookmarks'
]);

/** D1 caps a single string value at 2,000,000 bytes. Leave headroom. */
export const MAX_ITEM_PAYLOAD_CHARS = 1_800_000;
/** Bound parameter budget per upsert statement (one json_each array). */
const STATEMENT_PAYLOAD_BUDGET = 1_800_000;
/** Largest push body we accept. Clients chunk well below this. */
export const MAX_PUSH_BYTES = 6 * 1024 * 1024;
const MAX_ID_LENGTH = 200;

const PAGE_ROWS = 400;
const PAGE_BYTES = 3_000_000;

export interface PushItem {
  collection: string;
  localId: string;
  payload: string;
  updatedAt: number;
  deletedAt?: number | null;
}

function validPushItem(value: unknown): value is PushItem {
  if (!isRecord(value)) return false;
  const { collection, localId, payload, updatedAt, deletedAt } = value;
  if (typeof collection !== 'string' || !SYNC_COLLECTIONS.has(collection)) return false;
  if (typeof localId !== 'string' || localId.length === 0 || localId.length > MAX_ID_LENGTH) return false;
  if (typeof payload !== 'string' || payload.length < 2 || payload.length > MAX_ITEM_PAYLOAD_CHARS) return false;
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt) || updatedAt < 0) return false;
  if (deletedAt !== undefined && deletedAt !== null) {
    if (typeof deletedAt !== 'number' || !Number.isFinite(deletedAt) || deletedAt < 0) return false;
  }
  return true;
}

const UPSERT_SQL = `
INSERT INTO sync_items (uid, collection, local_id, payload, updated_at, deleted_at, server_seq)
SELECT ?1, c, lid, p, u, d, (SELECT seq FROM sync_state WHERE uid = ?1)
FROM (
  SELECT json_extract(value, '$.collection') AS c,
         json_extract(value, '$.localId') AS lid,
         json_extract(value, '$.payload') AS p,
         json_extract(value, '$.updatedAt') AS u,
         json_extract(value, '$.deletedAt') AS d
  FROM json_each(?2)
)
WHERE json_valid(p) AND json_type(p) = 'object' AND json_extract(p, '$.id') = lid
ON CONFLICT (uid, collection, local_id) DO UPDATE SET
  payload = excluded.payload,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at,
  server_seq = excluded.server_seq
WHERE COALESCE(excluded.deleted_at, excluded.updated_at) > COALESCE(sync_items.deleted_at, sync_items.updated_at)
   OR (COALESCE(excluded.deleted_at, excluded.updated_at) = COALESCE(sync_items.deleted_at, sync_items.updated_at)
       AND (excluded.payload IS NOT sync_items.payload
            OR excluded.deleted_at IS NOT sync_items.deleted_at
            OR excluded.updated_at IS NOT sync_items.updated_at))`;

const BUMP_SEQ_SQL = `
INSERT INTO sync_state (uid, seq) VALUES (?1, 1)
ON CONFLICT (uid) DO UPDATE SET seq = seq + 1
RETURNING seq`;

/** Split items into json_each arrays that each fit one bound parameter. */
export function chunkPushItems(items: PushItem[]): string[] {
  const chunks: string[] = [];
  let current: PushItem[] = [];
  let size = 2;
  for (const item of items) {
    const cost = item.payload.length + item.localId.length + 120;
    if (current.length > 0 && size + cost > STATEMENT_PAYLOAD_BUDGET) {
      chunks.push(JSON.stringify(current));
      current = [];
      size = 2;
    }
    current.push({
      collection: item.collection,
      localId: item.localId,
      payload: item.payload,
      updatedAt: item.updatedAt,
      ...(typeof item.deletedAt === 'number' ? { deletedAt: item.deletedAt } : {})
    });
    size += cost;
  }
  if (current.length > 0) chunks.push(JSON.stringify(current));
  return chunks;
}

async function headSeq(db: D1Database, uid: string): Promise<number> {
  const row = await db.prepare('SELECT seq FROM sync_state WHERE uid = ?1').bind(uid).first<{ seq: number }>();
  return row?.seq ?? 0;
}

export async function handlePush(request: Request, db: D1Database, user: AuthUser): Promise<Response> {
  await requirePro(db, user);
  const body = await readJson<unknown>(request, MAX_PUSH_BYTES);
  const rawItems = isRecord(body) && Array.isArray(body.items) ? body.items : null;
  if (!rawItems) throw new HttpError(400, 'bad_request', 'Expected { items: [...] }.');

  const items = rawItems.filter(validPushItem);
  const invalid = rawItems.length - items.length;
  if (items.length === 0) {
    const head = await headSeq(db, user.uid);
    return json({ accepted: 0, invalid, seq: head, prevSeq: head });
  }

  const chunks = chunkPushItems(items);
  const results = await db.batch([
    db.prepare(BUMP_SEQ_SQL).bind(user.uid),
    ...chunks.map((chunk) => db.prepare(UPSERT_SQL).bind(user.uid, chunk))
  ]);
  const seqRow = (results[0].results as Array<{ seq: number }> | undefined)?.[0];
  const seq = seqRow?.seq ?? (await headSeq(db, user.uid));
  const changed = results.slice(1).reduce((sum, result) => sum + (result.meta?.changes ?? 0), 0);

  return json({ accepted: items.length, changed, invalid, seq, prevSeq: seq - 1 });
}

interface ChangeRow {
  rid: number;
  server_seq: number;
  collection: string;
  local_id: string;
  payload: string;
  updated_at: number;
  deleted_at: number | null;
}

export function parseCursor(value: string | null): { seq: number; rid: number } {
  if (!value) return { seq: 0, rid: 0 };
  const match = /^(\d{1,15})\.(\d{1,16})$/.exec(value);
  if (!match) throw new HttpError(400, 'bad_cursor', 'Invalid sync cursor.');
  return { seq: Number(match[1]), rid: Number(match[2]) };
}

export function formatCursor(cursor: { seq: number; rid: number }): string {
  return `${cursor.seq}.${cursor.rid}`;
}

export async function handleChanges(url: URL, db: D1Database, user: AuthUser): Promise<Response> {
  let cursor = parseCursor(url.searchParams.get('cursor'));
  const head = await headSeq(db, user.uid);
  let reset = false;
  if (cursor.seq > head) {
    // The cursor came from a different database (or a restore). Start over.
    cursor = { seq: 0, rid: 0 };
    reset = true;
  }

  const { results } = await db
    .prepare(
      `SELECT rowid AS rid, server_seq, collection, local_id, payload, updated_at, deleted_at
       FROM sync_items
       WHERE uid = ?1 AND (server_seq > ?2 OR (server_seq = ?2 AND rowid > ?3))
       ORDER BY server_seq, rowid
       LIMIT ?4`
    )
    .bind(user.uid, cursor.seq, cursor.rid, PAGE_ROWS + 1)
    .all<ChangeRow>();

  const rows = results ?? [];
  const parts: string[] = [];
  let bytes = 0;
  let last: ChangeRow | null = null;
  for (const row of rows.slice(0, PAGE_ROWS)) {
    if (last && bytes + row.payload.length > PAGE_BYTES) break;
    bytes += row.payload.length;
    parts.push(
      `{"collection":${JSON.stringify(row.collection)},"localId":${JSON.stringify(row.local_id)},` +
        `"payload":${row.payload},"updatedAt":${Number(row.updated_at)}` +
        (row.deleted_at === null || row.deleted_at === undefined ? '' : `,"deletedAt":${Number(row.deleted_at)}`) +
        '}'
    );
    last = row;
  }

  const hasMore = rows.length > parts.length;
  const next = last ? { seq: last.server_seq, rid: last.rid } : cursor;
  const body =
    `{"items":[${parts.join(',')}],"cursor":${JSON.stringify(formatCursor(next))},` +
    `"hasMore":${hasMore},"head":${head},"reset":${reset}}`;
  return rawJson(body);
}

export interface ClearResult {
  deleted: number;
  skippedFiles: number;
}

/**
 * Wipe the caller's cloud copy. Evidence files whose asset record is
 * still live are kept, because another device may still be showing
 * them; everything else (records, tombstones, orphaned files) goes.
 */
export async function clearCloud(db: D1Database, bucket: R2Bucket, user: AuthUser): Promise<ClearResult> {
  const live = await db
    .prepare(
      `SELECT local_id FROM sync_items
       WHERE uid = ?1 AND collection = 'evidenceAssets' AND deleted_at IS NULL`
    )
    .bind(user.uid)
    .all<{ local_id: string }>();
  const liveAssetIds = new Set((live.results ?? []).map((row) => row.local_id));

  const files = await db
    .prepare('SELECT asset_id, object_key FROM asset_files WHERE uid = ?1')
    .bind(user.uid)
    .all<{ asset_id: string; object_key: string }>();
  const doomed = (files.results ?? []).filter((file) => !liveAssetIds.has(file.asset_id));

  for (let index = 0; index < doomed.length; index += 1000) {
    await bucket.delete(doomed.slice(index, index + 1000).map((file) => file.object_key));
  }

  const statements = [
    db.prepare('DELETE FROM sync_items WHERE uid = ?1').bind(user.uid),
    db.prepare(BUMP_SEQ_SQL).bind(user.uid),
    ...doomed.map((file) =>
      db.prepare('DELETE FROM asset_files WHERE uid = ?1 AND asset_id = ?2').bind(user.uid, file.asset_id)
    )
  ];
  const results = await db.batch(statements);
  const deletedItems = results[0].meta?.changes ?? 0;

  return { deleted: deletedItems + doomed.length, skippedFiles: (files.results ?? []).length - doomed.length };
}
