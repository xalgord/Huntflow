// HTTP request <-> cURL conversion utilities for evidence capture.

export interface HttpRequest {
  method: string;
  url: string;
  httpVersion?: string;
  headers: Array<{ name: string; value: string }>;
  body?: string;
}

const METHOD_PATTERN = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)\b/i;

export function parseRawHttpRequest(raw: string): HttpRequest | null {
  if (!raw || !raw.trim()) return null;

  const normalized = raw.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  if (lines.length === 0) return null;

  const requestLine = lines[0].trim();
  if (!METHOD_PATTERN.test(requestLine)) return null;

  const [method, target, httpVersion = 'HTTP/1.1'] = requestLine.split(/\s+/);
  if (!method || !target) return null;

  let host = '';
  const headers: Array<{ name: string; value: string }> = [];
  let cursor = 1;

  for (; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (line === '' || line.trim() === '') {
      cursor += 1;
      break;
    }
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const name = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (!name) continue;
    if (name.toLowerCase() === 'host') host = value;
    headers.push({ name, value });
  }

  const body = lines.slice(cursor).join('\n').replace(/\n+$/, '') || undefined;

  let url = target;
  if (!/^https?:\/\//i.test(target) && host) {
    const isHttps = headers.some((header) => header.name.toLowerCase() === 'x-forwarded-proto' && header.value.toLowerCase() === 'https');
    url = `${isHttps ? 'https' : 'http'}://${host}${target.startsWith('/') ? target : `/${target}`}`;
  }

  return {
    method: method.toUpperCase(),
    url,
    httpVersion,
    headers,
    body
  };
}

const CURL_FLAG_TOKEN = /^(-[A-Za-z]|--[A-Za-z][A-Za-z0-9-]*)$/;

export function parseCurl(input: string): HttpRequest | null {
  if (!input || !input.trim()) return null;

  const tokens = tokenizeShell(input.replace(/\\\n/g, ' ').replace(/\s+/g, ' ').trim());
  if (tokens.length === 0 || tokens[0].toLowerCase() !== 'curl') return null;

  let method = 'GET';
  let url = '';
  const headers: Array<{ name: string; value: string }> = [];
  let body: string | undefined;
  let cursor = 1;

  while (cursor < tokens.length) {
    const token = tokens[cursor];
    if (token === '-X' || token === '--request') {
      method = (tokens[cursor + 1] ?? 'GET').toUpperCase();
      cursor += 2;
      continue;
    }
    if (token === '-H' || token === '--header') {
      const value = tokens[cursor + 1] ?? '';
      const colon = value.indexOf(':');
      if (colon > 0) {
        headers.push({ name: value.slice(0, colon).trim(), value: value.slice(colon + 1).trim() });
      }
      cursor += 2;
      continue;
    }
    if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary' || token === '--data-urlencode') {
      body = tokens[cursor + 1] ?? '';
      if (method === 'GET') method = 'POST';
      cursor += 2;
      continue;
    }
    if (token === '-A' || token === '--user-agent') {
      headers.push({ name: 'User-Agent', value: tokens[cursor + 1] ?? '' });
      cursor += 2;
      continue;
    }
    if (token === '-e' || token === '--referer') {
      headers.push({ name: 'Referer', value: tokens[cursor + 1] ?? '' });
      cursor += 2;
      continue;
    }
    if (token === '-b' || token === '--cookie') {
      headers.push({ name: 'Cookie', value: tokens[cursor + 1] ?? '' });
      cursor += 2;
      continue;
    }
    if (token === '-u' || token === '--user') {
      const credentials = tokens[cursor + 1] ?? '';
      headers.push({ name: 'Authorization', value: `Basic ${typeof btoa !== 'undefined' ? btoa(credentials) : credentials}` });
      cursor += 2;
      continue;
    }
    if (token === '--compressed' || token === '-k' || token === '--insecure' || token === '-i' || token === '-s' || token === '-sS' || token === '-L') {
      cursor += 1;
      continue;
    }
    if (CURL_FLAG_TOKEN.test(token)) {
      // Unknown flag, skip its argument when present.
      const next = tokens[cursor + 1];
      if (next && !CURL_FLAG_TOKEN.test(next)) cursor += 2;
      else cursor += 1;
      continue;
    }
    if (!url) url = token;
    cursor += 1;
  }

  if (!url) return null;
  return { method, url, headers, body };
}

export function toCurl(request: HttpRequest): string {
  const lines: string[] = [`curl -X ${request.method.toUpperCase()} ${shellQuote(request.url)}`];

  for (const header of request.headers) {
    if (header.name.toLowerCase() === 'content-length') continue;
    lines.push(`  -H ${shellQuote(`${header.name}: ${header.value}`)}`);
  }

  if (request.body) {
    lines.push(`  --data-raw ${shellQuote(request.body)}`);
  }

  return lines.join(' \\\n');
}

export function toRawHttp(request: HttpRequest): string {
  let path = request.url;
  let host = '';

  try {
    const parsed = new URL(request.url);
    host = parsed.host;
    path = `${parsed.pathname}${parsed.search}` || '/';
  } catch {
    // Already a path-only string.
  }

  const lines = [`${request.method.toUpperCase()} ${path} ${request.httpVersion ?? 'HTTP/1.1'}`];
  if (host && !request.headers.some((header) => header.name.toLowerCase() === 'host')) {
    lines.push(`Host: ${host}`);
  }
  for (const header of request.headers) {
    lines.push(`${header.name}: ${header.value}`);
  }
  lines.push('');
  if (request.body) lines.push(request.body);

  return lines.join('\n');
}

function shellQuote(value: string): string {
  if (!value) return "''";
  if (!/[\s'"\\$`!]/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function tokenizeShell(input: string): string[] {
  const tokens: string[] = [];
  let buffer = '';
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (quote) {
      if (char === '\\' && quote === '"' && index + 1 < input.length) {
        buffer += input[index + 1];
        index += 1;
        continue;
      }
      if (char === quote) {
        quote = null;
        continue;
      }
      buffer += char;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '\\' && index + 1 < input.length) {
      buffer += input[index + 1];
      index += 1;
      continue;
    }

    if (/\s/.test(char)) {
      if (buffer) {
        tokens.push(buffer);
        buffer = '';
      }
      continue;
    }

    buffer += char;
  }

  if (buffer) tokens.push(buffer);
  return tokens;
}

export function summarizeHttpRequest(request: HttpRequest): string {
  try {
    const parsed = new URL(request.url);
    return `${request.method.toUpperCase()} ${parsed.pathname}${parsed.search} (${parsed.host})`;
  } catch {
    return `${request.method.toUpperCase()} ${request.url}`;
  }
}

// ─── Response & full-exchange parsing ────────────────────────────────────

const STATUS_LINE_PATTERN = /^HTTP\/\d(?:\.\d)?\s+(\d{3})\s*(.*)$/i;

export interface HttpResponse {
  httpVersion: string;
  statusCode: number;
  statusText: string;
  headers: Array<{ name: string; value: string }>;
  body?: string;
}

/**
 * Parse a raw HTTP response (status line + headers + optional body).
 * Tolerant of CRLF/LF and missing body. Returns null on garbage input
 * so callers can fall back to "raw text only" rendering.
 */
export function parseRawHttpResponse(raw: string): HttpResponse | null {
  if (!raw || !raw.trim()) return null;
  const normalized = raw.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  if (lines.length === 0) return null;

  const statusLine = lines[0].trim();
  const statusMatch = STATUS_LINE_PATTERN.exec(statusLine);
  if (!statusMatch) return null;

  const httpVersion = statusLine.split(/\s+/)[0] ?? 'HTTP/1.1';
  const statusCode = Number.parseInt(statusMatch[1], 10);
  const statusText = statusMatch[2].trim();

  const headers: Array<{ name: string; value: string }> = [];
  let cursor = 1;
  for (; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (line === '' || line.trim() === '') {
      cursor += 1;
      break;
    }
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const name = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (!name) continue;
    headers.push({ name, value });
  }

  const body = lines.slice(cursor).join('\n').replace(/\n+$/, '') || undefined;

  return { httpVersion, statusCode, statusText, headers, body };
}

export interface HttpExchange {
  request: HttpRequest;
  response?: HttpResponse;
  /** Original raw text the user pasted, preserved for byte-perfect copy/download. */
  raw: string;
  /** The split point (end-of-request) inside `raw`, or -1 if response-less. */
  responseOffset: number;
}

/**
 * Parse a request+response blob (the format you get when you "Copy all"
 * in Burp's repeater or Caido) into structured pieces. The split is
 * detected on the first line that matches an HTTP status line preceded
 * by a blank line — that's the canonical boundary in any tool's output.
 */
export function parseHttpExchange(raw: string): HttpExchange | null {
  if (!raw || !raw.trim()) return null;
  const normalized = raw.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  // Find the boundary: blank line whose next line is an HTTP/x status.
  let splitLine = -1;
  for (let index = 1; index < lines.length - 1; index += 1) {
    if (lines[index] !== '') continue;
    if (STATUS_LINE_PATTERN.test(lines[index + 1] ?? '')) {
      splitLine = index;
      break;
    }
  }

  if (splitLine === -1) {
    const request = parseRawHttpRequest(raw);
    if (!request) return null;
    return { request, raw, responseOffset: -1 };
  }

  const requestRaw = lines.slice(0, splitLine).join('\n');
  const responseRaw = lines.slice(splitLine + 1).join('\n');
  const request = parseRawHttpRequest(requestRaw);
  if (!request) return null;
  const response = parseRawHttpResponse(responseRaw) ?? undefined;

  // Compute byte offset of the response inside the raw blob so the UI
  // can highlight it without re-splitting later.
  const responseOffset = lines.slice(0, splitLine + 1).join('\n').length;

  return { request, response, raw, responseOffset };
}

export function summarizeHttpExchange(exchange: HttpExchange): string {
  const requestLine = summarizeHttpRequest(exchange.request);
  if (!exchange.response) return requestLine;
  return `${requestLine} → ${exchange.response.statusCode}`;
}

/** Extract just the host out of a request URL, falling back to the Host header. */
export function hostOfRequest(request: HttpRequest): string | undefined {
  try {
    return new URL(request.url).host;
  } catch {
    const hostHeader = request.headers.find((header) => header.name.toLowerCase() === 'host');
    return hostHeader?.value;
  }
}
