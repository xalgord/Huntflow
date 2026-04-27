/**
 * Passphrase-based encryption for HuntFlow workspace backups.
 *
 * Uses Web Crypto exclusively — no external deps, works offline, runs in
 * any modern browser. The format is a JSON envelope so a corrupted byte
 * doesn't make the whole bundle unrecoverable, and a future format change
 * can be detected via the `version` field.
 *
 * Format:
 *   {
 *     "magic": "HUNTFLOW-BACKUP",
 *     "version": 1,
 *     "encrypted": boolean,
 *     "kdf": { "name": "PBKDF2", "iterations": 250000, "salt": <base64> },  // when encrypted
 *     "iv": <base64>,                                                        // when encrypted
 *     "ciphertext": <base64>,                                                // when encrypted
 *     "payload": <object>                                                    // when not encrypted
 *   }
 */

export const BACKUP_MAGIC = 'HUNTFLOW-BACKUP';
export const BACKUP_VERSION = 1;
const PBKDF2_ITERATIONS = 250_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface EncryptedBackup {
  magic: typeof BACKUP_MAGIC;
  version: number;
  encrypted: true;
  kdf: { name: 'PBKDF2'; iterations: number; salt: string; hash: 'SHA-256' };
  iv: string;
  ciphertext: string;
  /** Free-form metadata that's safe to store outside the cipher. */
  meta: BackupMeta;
}

export interface PlainBackup {
  magic: typeof BACKUP_MAGIC;
  version: number;
  encrypted: false;
  payload: unknown;
  meta: BackupMeta;
}

export interface BackupMeta {
  exportedAt: number;
  appVersion: string;
  totals: Record<string, number>;
}

export type Backup = EncryptedBackup | PlainBackup;

// ─── Base64 helpers (browser-safe, no Buffer) ────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  // Chunked to avoid "Maximum call stack size exceeded" on very large blobs.
  const CHUNK = 0x8000;
  let str = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    str += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(str);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ─── KDF + cipher ────────────────────────────────────────────────────────────

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBackup(
  payload: unknown,
  passphrase: string,
  meta: BackupMeta
): Promise<EncryptedBackup> {
  if (!passphrase || passphrase.length < 6) {
    throw new Error('Passphrase must be at least 6 characters.');
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);

  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  );

  return {
    magic: BACKUP_MAGIC,
    version: BACKUP_VERSION,
    encrypted: true,
    kdf: {
      name: 'PBKDF2',
      iterations: PBKDF2_ITERATIONS,
      salt: bytesToBase64(salt),
      hash: 'SHA-256'
    },
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
    meta
  };
}

export async function decryptBackup(bundle: EncryptedBackup, passphrase: string): Promise<unknown> {
  if (bundle.magic !== BACKUP_MAGIC) {
    throw new Error('This file is not a HuntFlow backup.');
  }
  if (bundle.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version ${bundle.version}.`);
  }
  const salt = base64ToBytes(bundle.kdf.salt);
  const iv = base64ToBytes(bundle.iv);
  const key = await deriveKey(passphrase, salt);

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      base64ToBytes(bundle.ciphertext)
    );
  } catch {
    throw new Error('Wrong passphrase or the backup is corrupted.');
  }
  return JSON.parse(new TextDecoder().decode(plaintext));
}

export function makePlainBackup(payload: unknown, meta: BackupMeta): PlainBackup {
  return {
    magic: BACKUP_MAGIC,
    version: BACKUP_VERSION,
    encrypted: false,
    payload,
    meta
  };
}

export function isBackup(value: unknown): value is Backup {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { magic?: unknown }).magic === BACKUP_MAGIC
  );
}

// ─── Blob helpers for evidence binaries ──────────────────────────────────────

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  return bytesToBase64(buf);
}

export function base64ToBlob(b64: string, mimeType: string): Blob {
  return new Blob([base64ToBytes(b64)], { type: mimeType });
}
