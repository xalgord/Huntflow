/**
 * Pure helpers for the cloud sync engine's delta protocol. Kept free of
 * IndexedDB, stores and fetch so they can be unit-tested directly.
 *
 *   - A device remembers a signature for every item the cloud already
 *     has (pushed by us or pulled from it). A push only sends items
 *     whose signature changed, so an idle device sends nothing.
 *   - Pulled changes are applied only where the remote copy actually
 *     wins last-writer-wins against the local copy.
 */
import type { PushWireItem } from './api';
import { mergeItems, type SyncItem } from './syncMerge';

/** Target size of one push request body. The server accepts up to 6 MB. */
export const PUSH_CHUNK_BYTES = 900_000;
/** Matches the server's per-item cap (D1 rows top out at 2 MB). */
export const MAX_PUSH_PAYLOAD_CHARS = 1_800_000;

export function itemKey(item: { collection: string; localId: string }): string {
  return `${item.collection}:${item.localId}`;
}

/** 32-bit FNV-1a over UTF-16 code units — cheap change detection, not security. */
export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function signatureOf(item: SyncItem, payloadText: string): string {
  return `${item.updatedAt}:${item.deletedAt ?? ''}:${payloadText.length}:${fnv1a(payloadText)}`;
}

export interface PushPlan {
  wire: PushWireItem[];
  /** Signature to record for each key once the push succeeds. */
  signatures: Map<string, string>;
  /** Items too large to sync (reported, never sent). */
  oversized: string[];
}

export function planPush(localItems: SyncItem[], acknowledged: ReadonlyMap<string, string>): PushPlan {
  const wire: PushWireItem[] = [];
  const signatures = new Map<string, string>();
  const oversized: string[] = [];
  for (const item of localItems) {
    const payloadText = JSON.stringify(item.payload);
    const key = itemKey(item);
    const signature = signatureOf(item, payloadText);
    if (acknowledged.get(key) === signature) continue;
    if (payloadText.length > MAX_PUSH_PAYLOAD_CHARS) {
      oversized.push(key);
      continue;
    }
    wire.push({
      collection: item.collection,
      localId: item.localId,
      payload: payloadText,
      updatedAt: item.updatedAt,
      ...(typeof item.deletedAt === 'number' ? { deletedAt: item.deletedAt } : {})
    });
    signatures.set(key, signature);
  }
  return { wire, signatures, oversized };
}

export function chunkWireItems(items: PushWireItem[], maxBytes = PUSH_CHUNK_BYTES): PushWireItem[][] {
  const chunks: PushWireItem[][] = [];
  let current: PushWireItem[] = [];
  let size = 0;
  for (const item of items) {
    const cost = item.payload.length + item.localId.length + 96;
    if (current.length > 0 && size + cost > maxBytes) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(item);
    size += cost;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Remote items that should overwrite local state: the ones that win
 * the same last-writer-wins rule `mergeItems` applies (ties go to the
 * remote copy, so an in-place edit on another device lands here).
 */
export function remoteWinners(localItems: SyncItem[], remoteItems: SyncItem[]): SyncItem[] {
  if (remoteItems.length === 0) return [];
  const remoteKeys = new Set(remoteItems.map(itemKey));
  const relevantLocal = localItems.filter((item) => remoteKeys.has(itemKey(item)));
  const merged = mergeItems(relevantLocal, remoteItems);
  const remoteSet = new Set(remoteItems);
  return merged.filter((item) => remoteSet.has(item));
}

const CURSOR_RE = /^\d{1,15}\.\d{1,16}$/;
/** Larger than any D1 rowid we will see; "past every row of this seq". */
const END_OF_SEQ = 9_007_199_254_740_991;

export function isValidCursor(value: string | null | undefined): value is string {
  return typeof value === 'string' && CURSOR_RE.test(value);
}

export function cursorSeq(cursor: string | null): number {
  return isValidCursor(cursor) ? Number(cursor.split('.')[0]) : 0;
}

/** Cursor that skips the rows written by a push we just made. */
export function cursorAfterOwnPush(seq: number): string {
  return `${seq}.${END_OF_SEQ}`;
}
