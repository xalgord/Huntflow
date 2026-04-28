import { decodeJwt, base64Decode, isTransformError } from './transforms';
import { parseCurl, parseHttpExchange, summarizeHttpExchange, summarizeHttpRequest, type HttpExchange, type HttpRequest } from './http';

/**
 * Result of classifying clipboard / paste content for the global Quick
 * Capture flow. The classifier never throws — anything it doesn't
 * recognise becomes a `'note'` so the user always has a path to save.
 *
 * Detection priority (most specific → most generic):
 *   1. HTTP exchange (request + response)
 *   2. Raw HTTP request alone
 *   3. cURL command
 *   4. JWT (three dot-separated base64url parts that decode to JSON)
 *   5. Standalone URL
 *   6. Base64 blob (long, only base64 alphabet, decodes to printable)
 *   7. Plain note
 */
export type CapturedKind =
  | 'http-exchange'
  | 'http-request'
  | 'curl'
  | 'jwt'
  | 'url'
  | 'base64'
  | 'note';

export interface CapturedClassification {
  kind: CapturedKind;
  /** A short single-line summary suitable for the chip beside the input. */
  summary: string;
  /** The original text, trimmed of trailing whitespace only. */
  text: string;
  /** Optional structured payload depending on `kind`. */
  exchange?: HttpExchange;
  request?: HttpRequest;
  jwt?: { algorithm?: string; subject?: string; isExpired: boolean; payloadPreview: string };
  base64Decoded?: string;
  url?: { href: string; host: string };
}

const URL_ONLY_PATTERN = /^https?:\/\/[^\s]+$/i;
const BASE64_PATTERN = /^[A-Za-z0-9+/=_-]+$/;
const HTTP_METHOD_LINE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)\s+\S+/i;

function looksLikeJwt(text: string): boolean {
  if (!text.includes('.')) return false;
  const parts = text.trim().split('.');
  if (parts.length !== 3) return false;
  return parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part) && part.length > 0);
}

function looksLikeBase64(text: string): boolean {
  // Must be one tight blob, reasonably long, and decode to mostly printable
  // ASCII. We deliberately reject very short strings to avoid mis-classifying
  // plain words like "test".
  const trimmed = text.trim();
  if (trimmed.length < 16) return false;
  if (trimmed.length % 4 !== 0 && !trimmed.includes('-') && !trimmed.includes('_')) return false;
  if (!BASE64_PATTERN.test(trimmed)) return false;
  if (/\s/.test(trimmed)) return false;
  const decoded = base64Decode(trimmed);
  if (isTransformError(decoded)) return false;
  // Reject if more than 10% of the decoded characters are non-printable.
  let printable = 0;
  for (const ch of decoded) {
    const code = ch.charCodeAt(0);
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126) || code > 127) {
      printable += 1;
    }
  }
  return printable / decoded.length > 0.9;
}

function shorten(value: string, max = 96): string {
  const oneLine = value.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

export function classifyClipboard(rawInput: string): CapturedClassification {
  const text = rawInput.replace(/\s+$/, '');
  const trimmed = text.trim();

  if (!trimmed) {
    return { kind: 'note', summary: 'Empty paste', text };
  }

  // 1. Full HTTP exchange (request + response) — highest specificity.
  if (HTTP_METHOD_LINE.test(trimmed.split('\n', 1)[0] ?? '')) {
    const exchange = parseHttpExchange(text);
    if (exchange) {
      if (exchange.response) {
        return {
          kind: 'http-exchange',
          summary: summarizeHttpExchange(exchange),
          text,
          exchange,
          request: exchange.request
        };
      }
      return {
        kind: 'http-request',
        summary: summarizeHttpRequest(exchange.request),
        text,
        exchange,
        request: exchange.request
      };
    }
  }

  // 2. cURL command.
  if (/^curl\s/i.test(trimmed)) {
    const request = parseCurl(text);
    if (request) {
      return {
        kind: 'curl',
        summary: summarizeHttpRequest(request),
        text,
        request
      };
    }
  }

  // 3. JWT.
  if (looksLikeJwt(trimmed)) {
    const decoded = decodeJwt(trimmed);
    if (typeof decoded !== 'string') {
      const payload = decoded.payload as Record<string, unknown> | null | undefined;
      const subject =
        payload && typeof payload === 'object'
          ? (payload['sub'] as string | undefined) ?? (payload['email'] as string | undefined)
          : undefined;
      return {
        kind: 'jwt',
        summary: `JWT ${decoded.algorithm ?? '?'}${subject ? ` · ${subject}` : ''}${decoded.isExpired ? ' · expired' : ''}`,
        text,
        jwt: {
          algorithm: decoded.algorithm,
          subject,
          isExpired: decoded.isExpired,
          payloadPreview: shorten(JSON.stringify(decoded.payload), 120)
        }
      };
    }
  }

  // 4. Standalone URL.
  if (URL_ONLY_PATTERN.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return {
        kind: 'url',
        summary: `${parsed.host}${parsed.pathname}${parsed.search}`,
        text: trimmed,
        url: { href: parsed.href, host: parsed.host }
      };
    } catch {
      // fall through to note
    }
  }

  // 5. Base64 blob.
  if (looksLikeBase64(trimmed)) {
    const decoded = base64Decode(trimmed);
    if (!isTransformError(decoded)) {
      return {
        kind: 'base64',
        summary: `Base64 · ${shorten(decoded, 80)}`,
        text: trimmed,
        base64Decoded: decoded
      };
    }
  }

  // 6. Plain note.
  return {
    kind: 'note',
    summary: shorten(trimmed),
    text
  };
}

/**
 * Friendly label for the detected kind, used for chips and form copy.
 */
export function capturedKindLabel(kind: CapturedKind): string {
  if (kind === 'http-exchange') return 'HTTP exchange';
  if (kind === 'http-request') return 'HTTP request';
  if (kind === 'curl') return 'cURL command';
  if (kind === 'jwt') return 'JWT';
  if (kind === 'url') return 'URL';
  if (kind === 'base64') return 'Base64 blob';
  return 'Note';
}
