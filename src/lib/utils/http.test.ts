import { describe, expect, it } from 'vitest';
import {
  parseRawHttpRequest,
  parseCurl,
  toCurl,
  toRawHttp,
  parseRawHttpResponse,
  parseHttpExchange,
  summarizeHttpRequest,
  hostOfRequest
} from './http';

describe('parseRawHttpRequest', () => {
  it('parses a basic GET request', () => {
    const raw = 'GET /path HTTP/1.1\nHost: example.com\nUser-Agent: test\n';
    const result = parseRawHttpRequest(raw);
    expect(result).not.toBeNull();
    expect(result!.method).toBe('GET');
    expect(result!.url).toBe('http://example.com/path');
    expect(result!.headers).toHaveLength(2);
    expect(result!.headers[0]).toEqual({ name: 'Host', value: 'example.com' });
  });

  it('parses a POST request with body', () => {
    const raw = 'POST /api HTTP/1.1\nHost: example.com\nContent-Type: application/json\n\n{"key":"value"}';
    const result = parseRawHttpRequest(raw);
    expect(result).not.toBeNull();
    expect(result!.method).toBe('POST');
    expect(result!.body).toBe('{"key":"value"}');
  });

  it('handles CRLF line endings', () => {
    const raw = 'GET / HTTP/1.1\r\nHost: example.com\r\n';
    const result = parseRawHttpRequest(raw);
    expect(result).not.toBeNull();
    expect(result!.method).toBe('GET');
  });

  it('returns null for empty input', () => {
    expect(parseRawHttpRequest('')).toBeNull();
    expect(parseRawHttpRequest('   ')).toBeNull();
  });

  it('returns null for non-HTTP input', () => {
    expect(parseRawHttpRequest('not an http request')).toBeNull();
  });

  it('constructs URL from Host header for relative paths', () => {
    const raw = 'GET /page HTTP/1.1\nHost: example.com\n';
    const result = parseRawHttpRequest(raw);
    expect(result!.url).toBe('http://example.com/page');
  });

  it('preserves absolute URLs', () => {
    const raw = 'GET https://example.com/page HTTP/1.1\nHost: example.com\n';
    const result = parseRawHttpRequest(raw);
    expect(result!.url).toBe('https://example.com/page');
  });
});

describe('parseCurl', () => {
  it('parses a basic curl command', () => {
    const result = parseCurl("curl https://example.com");
    expect(result).not.toBeNull();
    expect(result!.method).toBe('GET');
    expect(result!.url).toBe('https://example.com');
  });

  it('parses curl with -X POST', () => {
    const result = parseCurl("curl -X POST https://example.com/api");
    expect(result).not.toBeNull();
    expect(result!.method).toBe('POST');
  });

  it('parses curl with headers', () => {
    const result = parseCurl("curl -H 'Authorization: Bearer token' https://example.com");
    expect(result).not.toBeNull();
    expect(result!.headers).toHaveLength(1);
    expect(result!.headers[0].name).toBe('Authorization');
  });

  it('parses curl with -d data (auto-sets POST)', () => {
    const result = parseCurl("curl -d 'key=value' https://example.com");
    expect(result).not.toBeNull();
    expect(result!.method).toBe('POST');
    expect(result!.body).toBe('key=value');
  });

  it('parses curl with --data-raw', () => {
    const result = parseCurl("curl --data-raw '{\"a\":1}' https://example.com");
    expect(result).not.toBeNull();
    expect(result!.body).toBe('{"a":1}');
  });

  it('parses curl with -A user agent', () => {
    const result = parseCurl("curl -A 'MyAgent' https://example.com");
    expect(result).not.toBeNull();
    expect(result!.headers).toHaveLength(1);
    expect(result!.headers[0]).toEqual({ name: 'User-Agent', value: 'MyAgent' });
  });

  it('ignores -k and --compressed flags', () => {
    const result = parseCurl("curl -k --compressed https://example.com");
    expect(result).not.toBeNull();
    expect(result!.url).toBe('https://example.com');
  });

  it('returns null for empty input', () => {
    expect(parseCurl('')).toBeNull();
  });

  it('returns null for non-curl input', () => {
    expect(parseCurl('wget https://example.com')).toBeNull();
  });

  it('handles double-quoted strings with escapes', () => {
    const result = parseCurl('curl -H "Authorization: Bearer \\"quoted\\"" https://example.com');
    expect(result).not.toBeNull();
    expect(result!.headers[0].name).toBe('Authorization');
    expect(result!.headers[0].value).toBe('Bearer "quoted"');
  });
});

describe('toCurl', () => {
  it('converts a simple GET request', () => {
    const result = toCurl({
      method: 'GET',
      url: 'https://example.com/path',
      headers: []
    });
    expect(result).toContain('curl -X GET');
    expect(result).toContain('https://example.com/path');
  });

  it('includes headers', () => {
    const result = toCurl({
      method: 'GET',
      url: 'https://example.com',
      headers: [{ name: 'Authorization', value: 'Bearer token' }]
    });
    expect(result).toContain("-H 'Authorization: Bearer token'");
  });

  it('includes body with --data-raw', () => {
    const result = toCurl({
      method: 'POST',
      url: 'https://example.com',
      headers: [],
      body: '{"key":"value"}'
    });
    expect(result).toContain("--data-raw");
    expect(result).toContain('{"key":"value"}');
  });

  it('skips Content-Length header', () => {
    const result = toCurl({
      method: 'POST',
      url: 'https://example.com',
      headers: [
        { name: 'Content-Length', value: '42' },
        { name: 'Content-Type', value: 'application/json' }
      ]
    });
    expect(result).not.toContain('Content-Length');
    expect(result).toContain('Content-Type');
  });
});

describe('toRawHttp', () => {
  it('converts a request to raw HTTP format', () => {
    const result = toRawHttp({
      method: 'GET',
      url: 'https://example.com/path',
      headers: [{ name: 'User-Agent', value: 'test' }]
    });
    expect(result).toContain('GET /path HTTP/1.1');
    expect(result).toContain('Host: example.com');
    expect(result).toContain('User-Agent: test');
  });

  it('includes body', () => {
    const result = toRawHttp({
      method: 'POST',
      url: 'https://example.com/api',
      headers: [],
      body: 'data'
    });
    expect(result).toContain('POST /api HTTP/1.1');
    expect(result).toContain('\ndata');
  });
});

describe('parseRawHttpResponse', () => {
  it('parses a basic HTTP response', () => {
    const raw = 'HTTP/1.1 200 OK\nContent-Type: text/html\n\n<h1>Hello</h1>';
    const result = parseRawHttpResponse(raw);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(200);
    expect(result!.statusText).toBe('OK');
    expect(result!.headers).toHaveLength(1);
    expect(result!.body).toBe('<h1>Hello</h1>');
  });

  it('parses a response with no body', () => {
    const raw = 'HTTP/1.1 204 No Content\n';
    const result = parseRawHttpResponse(raw);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(204);
  });

  it('returns null for empty input', () => {
    expect(parseRawHttpResponse('')).toBeNull();
  });

  it('returns null for non-HTTP status line', () => {
    expect(parseRawHttpResponse('not a response')).toBeNull();
  });

  it('handles CRLF line endings', () => {
    const raw = 'HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n';
    const result = parseRawHttpResponse(raw);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(404);
  });
});

describe('parseHttpExchange', () => {
  it('parses a request+response pair', () => {
    const raw = 'GET /api HTTP/1.1\nHost: example.com\n\nHTTP/1.1 200 OK\nContent-Type: application/json\n\n{"ok":true}';
    const result = parseHttpExchange(raw);
    expect(result).not.toBeNull();
    expect(result!.request.method).toBe('GET');
    expect(result!.response).toBeDefined();
    expect(result!.response!.statusCode).toBe(200);
    expect(result!.responseOffset).toBeGreaterThan(0);
  });

  it('handles request-only exchange', () => {
    const raw = 'GET /page HTTP/1.1\nHost: example.com\n';
    const result = parseHttpExchange(raw);
    expect(result).not.toBeNull();
    expect(result!.request.method).toBe('GET');
    expect(result!.response).toBeUndefined();
    expect(result!.responseOffset).toBe(-1);
  });

  it('returns null for empty input', () => {
    expect(parseHttpExchange('')).toBeNull();
  });
});

describe('summarizeHttpRequest', () => {
  it('produces method + path + host summary', () => {
    const summary = summarizeHttpRequest({
      method: 'GET',
      url: 'https://example.com/api/users?page=1',
      headers: []
    });
    expect(summary).toBe('GET /api/users?page=1 (example.com)');
  });

  it('falls back to raw URL when parsing fails', () => {
    const summary = summarizeHttpRequest({
      method: 'GET',
      url: 'not-a-url',
      headers: []
    });
    expect(summary).toBe('GET not-a-url');
  });
});

describe('hostOfRequest', () => {
  it('extracts host from URL', () => {
    const host = hostOfRequest({
      method: 'GET',
      url: 'https://example.com:8080/path',
      headers: []
    });
    expect(host).toBe('example.com:8080');
  });

  it('falls back to Host header', () => {
    const host = hostOfRequest({
      method: 'GET',
      url: '/path',
      headers: [{ name: 'Host', value: 'example.com' }]
    });
    expect(host).toBe('example.com');
  });

  it('returns undefined when no host available', () => {
    const host = hostOfRequest({
      method: 'GET',
      url: '/path',
      headers: []
    });
    expect(host).toBeUndefined();
  });
});
