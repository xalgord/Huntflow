import { describe, expect, it } from 'vitest';
import type { Submission, Target } from '$lib/types';
import { createFinding, evidenceFromHttp, findingBucket, withStatus } from './findingWorkflow';

const program = { id: 'p1', name: 'Acme', platform: 'bugcrowd' } as Target;

describe('createFinding', () => {
  it('starts a draft on the program\'s platform with a timeline entry', () => {
    const finding = createFinding(program, {}, 100);
    expect(finding).toMatchObject({ status: 'draft', targetId: 'p1', platform: 'bugcrowd', createdAt: 100 });
    expect(finding.timeline).toHaveLength(1);
  });
});

describe('withStatus', () => {
  const draft: Submission = createFinding(program, {}, 100);

  it('stamps lifecycle timestamps once and records the timeline', () => {
    const submitted = withStatus(draft, 'submitted', 200);
    expect(submitted.submittedAt).toBe(200);
    const triaged = withStatus(submitted, 'triaged', 300);
    expect(triaged).toMatchObject({ submittedAt: 200, triagedAt: 300 });
    const rewarded = withStatus(triaged, 'rewarded', 400);
    expect(rewarded).toMatchObject({ triagedAt: 300, resolvedAt: 400, rewardedAt: 400 });
    expect(rewarded.timeline.map((entry) => entry.status)).toEqual(['draft', 'submitted', 'triaged', 'rewarded']);
  });

  it('is a no-op for the current status', () => {
    expect(withStatus(draft, 'draft', 999)).toBe(draft);
  });

  it('does not mark closed-as-duplicate findings as triaged', () => {
    const duplicate = withStatus(withStatus(draft, 'submitted', 200), 'duplicate', 300);
    expect(duplicate.triagedAt).toBeUndefined();
    expect(findingBucket(duplicate.status)).toBe('closed');
  });
});

describe('evidenceFromHttp', () => {
  it('parses a Burp-style request/response pair', () => {
    const raw = 'GET /api/orders/9 HTTP/1.1\r\nHost: api.acme.test\r\nCookie: s=1\r\n\r\nHTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"id":9}';
    const asset = evidenceFromHttp(raw, 'p1', 5)!;
    expect(asset.kind).toBe('http-exchange');
    expect(asset.httpExchange).toMatchObject({ method: 'GET', host: 'api.acme.test', statusCode: 200 });
    expect(asset.httpExchange?.requestRaw).toContain('Host: api.acme.test');
    expect(asset.httpExchange?.responseRaw).toContain('{"id":9}');
    expect(asset.targetId).toBe('p1');
  });

  it('accepts curl commands and rejects junk', () => {
    const asset = evidenceFromHttp("curl 'https://api.acme.test/v1/me' -H 'Authorization: Bearer x'", undefined)!;
    expect(asset.httpExchange?.method).toBe('GET');
    expect(asset.httpExchange?.requestRaw).toContain('Authorization: Bearer x');
    expect(evidenceFromHttp('hello world', undefined)).toBeNull();
  });
});
