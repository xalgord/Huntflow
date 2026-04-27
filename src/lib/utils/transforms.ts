/**
 * Pure-function string/binary transforms used by the Hunter Toolkit page.
 * Every function returns a string and never throws — invalid inputs return
 * a leading `Error: ` prefix so the UI can render the message inline next
 * to the matching field instead of erroring out the whole panel.
 */

const ERROR_PREFIX = 'Error: ';
const isError = (value: string): boolean => value.startsWith(ERROR_PREFIX);
export const formatError = (msg: string): string => `${ERROR_PREFIX}${msg}`;
export const isTransformError = isError;

// ─── URL ─────────────────────────────────────────────────────────────────
export const urlEncode = (input: string): string => {
  try {
    return encodeURIComponent(input);
  } catch (e) {
    return formatError(e instanceof Error ? e.message : 'urlEncode failed');
  }
};
export const urlDecode = (input: string): string => {
  try {
    return decodeURIComponent(input.replace(/\+/g, '%20'));
  } catch (e) {
    return formatError(e instanceof Error ? e.message : 'urlDecode failed');
  }
};

// Double URL-encoding is a common bypass technique; provide a one-click form.
export const urlEncodeAll = (input: string): string =>
  Array.from(input)
    .map((ch) => `%${ch.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()}`)
    .join('');

// ─── Base64 ──────────────────────────────────────────────────────────────
export const base64Encode = (input: string): string => {
  try {
    // btoa only accepts Latin-1; round-trip through UTF-8 first.
    return btoa(unescape(encodeURIComponent(input)));
  } catch (e) {
    return formatError(e instanceof Error ? e.message : 'base64Encode failed');
  }
};
export const base64Decode = (input: string): string => {
  try {
    return decodeURIComponent(escape(atob(input.trim())));
  } catch (e) {
    return formatError(e instanceof Error ? e.message : 'base64Decode failed');
  }
};
export const base64UrlEncode = (input: string): string => {
  const out = base64Encode(input);
  if (isError(out)) return out;
  return out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const base64UrlDecode = (input: string): string => {
  const padding = '='.repeat((4 - (input.length % 4)) % 4);
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/') + padding;
  return base64Decode(normalized);
};

// ─── Hex ─────────────────────────────────────────────────────────────────
export const hexEncode = (input: string): string =>
  Array.from(new TextEncoder().encode(input))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
export const hexDecode = (input: string): string => {
  try {
    const cleaned = input.replace(/[^0-9a-fA-F]/g, '');
    if (cleaned.length % 2 !== 0) return formatError('Hex must have an even number of digits.');
    const bytes = new Uint8Array(cleaned.length / 2);
    for (let i = 0; i < cleaned.length; i += 2) {
      bytes[i / 2] = parseInt(cleaned.slice(i, i + 2), 16);
    }
    return new TextDecoder().decode(bytes);
  } catch (e) {
    return formatError(e instanceof Error ? e.message : 'hexDecode failed');
  }
};

// ─── HTML entities ───────────────────────────────────────────────────────
const HTML_ENT: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;'
};
export const htmlEncode = (input: string): string =>
  input.replace(/[&<>"'/]/g, (c) => HTML_ENT[c] ?? c);

const ENT_REVERSE: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  '#x2F': '/',
  '#47': '/'
};
export const htmlDecode = (input: string): string =>
  input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (full, name) => {
    const lower = name.toLowerCase();
    if (lower in ENT_REVERSE) return ENT_REVERSE[lower];
    if (lower.startsWith('#x')) {
      const code = parseInt(lower.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    if (lower.startsWith('#')) {
      const code = parseInt(lower.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return full;
  });

// ─── Unicode escape ──────────────────────────────────────────────────────
export const unicodeEscape = (input: string): string =>
  Array.from(input)
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code < 0x80 ? ch : `\\u${code.toString(16).padStart(4, '0')}`;
    })
    .join('');
export const unicodeUnescape = (input: string): string =>
  input.replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)));

// ─── JWT (decode only — never trust client-side verification of unknown tokens) ──
export interface JwtParts {
  header: unknown;
  payload: unknown;
  signature: string;
  raw: { header: string; payload: string; signature: string };
  expiresAt?: number;
  issuedAt?: number;
  isExpired: boolean;
  algorithm?: string;
}

export function decodeJwt(token: string): JwtParts | string {
  const trimmed = token.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3) return formatError('A JWT has three dot-separated parts.');
  try {
    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    const exp = typeof payload?.exp === 'number' ? payload.exp * 1000 : undefined;
    const iat = typeof payload?.iat === 'number' ? payload.iat * 1000 : undefined;
    return {
      header,
      payload,
      signature: parts[2],
      raw: { header: parts[0], payload: parts[1], signature: parts[2] },
      expiresAt: exp,
      issuedAt: iat,
      isExpired: typeof exp === 'number' ? exp < Date.now() : false,
      algorithm: typeof header?.alg === 'string' ? header.alg : undefined
    };
  } catch (e) {
    return formatError(e instanceof Error ? e.message : 'Could not parse JWT.');
  }
}

// ─── Hash (Web Crypto) ───────────────────────────────────────────────────
export async function digest(
  algorithm: 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512',
  input: string
): Promise<string> {
  const buf = await crypto.subtle.digest(algorithm, new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Random / IDs ────────────────────────────────────────────────────────
export function randomUuid(): string {
  return crypto.randomUUID();
}
export function randomToken(byteLength: number, encoding: 'hex' | 'base64' | 'base64url' = 'hex'): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  if (encoding === 'hex') {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let str = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    str += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  const b64 = btoa(str);
  return encoding === 'base64url' ? b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b64;
}
