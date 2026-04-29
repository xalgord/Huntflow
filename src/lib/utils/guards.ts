/**
 * Shared type guard utilities.
 *
 * Extracted from `sync.ts` and `assets.ts` to avoid duplication.
 */

/** Runtime check: is `value` a plain object (not null, not an array)? */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
