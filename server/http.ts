/**
 * Small HTTP helpers shared by every HuntFlow API handler.
 *
 * Errors are thrown as `HttpError` and turned into JSON by the router,
 * so handlers read top-to-bottom without nested response plumbing.
 */

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type')) headers.set('content-type', 'application/json; charset=utf-8');
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(body), { ...init, headers });
}

/** A JSON response whose body is already serialised (avoids a parse/stringify round trip). */
export function rawJson(body: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store');
  return new Response(body, { ...init, headers });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error('[api] unhandled error', error);
  return json({ error: 'Something went wrong on our side. Please try again.', code: 'internal' }, { status: 500 });
}

/**
 * Parse a JSON body with a hard byte cap. The cap is checked against
 * Content-Length first (cheap) and again against the decoded text so a
 * chunked request can't slip past it.
 */
export async function readJson<T = unknown>(request: Request, maxBytes: number): Promise<T> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > maxBytes) throw new HttpError(413, 'too_large', 'Request body is too large.');
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'too_large', 'Request body is too large.');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'bad_json', 'Request body must be valid JSON.');
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/huntflow\.xalgorix\.com$/,
  /^https:\/\/([a-z0-9-]+\.)?huntflow-dpx\.pages\.dev$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/
];

/**
 * CORS for the API. Auth is a bearer token (never a cookie), so a
 * cross-origin page can't ride a user's session; the allowlist only
 * keeps the surface tidy for the hosted site, preview deploys and the
 * local CLI build that talks to the hosted API.
 */
export function corsHeaders(request: Request): Headers {
  const headers = new Headers();
  const origin = request.headers.get('origin');
  if (origin && ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))) {
    headers.set('access-control-allow-origin', origin);
    headers.set('vary', 'origin');
    headers.set('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set(
      'access-control-allow-headers',
      'authorization, content-type, x-hf-file-name, x-hf-relative-path'
    );
    headers.set(
      'access-control-expose-headers',
      'x-hf-file-name, x-hf-relative-path, x-hf-uploaded-at, x-hf-size'
    );
    headers.set('access-control-max-age', '86400');
  }
  return headers;
}

export function withHeaders(response: Response, extra: Headers): Response {
  const merged = new Response(response.body, response);
  extra.forEach((value, key) => merged.headers.set(key, value));
  return merged;
}
