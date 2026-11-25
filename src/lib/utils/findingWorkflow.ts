/**
 * Finding lifecycle helpers shared by the Findings workspace and quick
 * actions elsewhere (Today, notes, payouts).
 */
import type { EvidenceAsset, Platform, Submission, SubmissionStatus, Target } from '$lib/types';
import { hostOfRequest, parseCurl, parseHttpExchange, toRawHttp } from './http';
import { generateId } from './id';

export const STATUS_FLOW: SubmissionStatus[] = ['draft', 'submitted', 'triaged', 'accepted', 'resolved', 'rewarded'];
export const CLOSED_STATUSES: SubmissionStatus[] = ['duplicate', 'informational', 'not-applicable', 'closed'];

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  triaged: 'Triaged',
  accepted: 'Accepted',
  duplicate: 'Duplicate',
  informational: 'Informative',
  'not-applicable': 'Not Applicable',
  resolved: 'Resolved',
  rewarded: 'Rewarded',
  closed: 'Closed'
};

export type FindingBucket = 'drafts' | 'open' | 'closed';

export function findingBucket(status: SubmissionStatus): FindingBucket {
  if (status === 'draft') return 'drafts';
  if (CLOSED_STATUSES.includes(status) || status === 'rewarded' || status === 'resolved') return 'closed';
  return 'open';
}

/**
 * Move a finding to a new status, stamping lifecycle timestamps the first
 * time each phase is reached and appending a timeline entry.
 */
export function withStatus(finding: Submission, status: SubmissionStatus, now = Date.now(), note?: string): Submission {
  if (finding.status === status) return finding;
  const reached = (target: SubmissionStatus) => STATUS_FLOW.indexOf(status) >= STATUS_FLOW.indexOf(target);
  const inFlow = STATUS_FLOW.includes(status);
  return {
    ...finding,
    status,
    submittedAt: finding.submittedAt ?? (status !== 'draft' ? now : undefined),
    triagedAt: finding.triagedAt ?? (inFlow && reached('triaged') ? now : undefined),
    resolvedAt: finding.resolvedAt ?? (inFlow && reached('resolved') ? now : status === 'closed' ? now : undefined),
    rewardedAt: finding.rewardedAt ?? (status === 'rewarded' ? now : undefined),
    timeline: [...(finding.timeline ?? []), { id: generateId(), status, at: now, ...(note ? { note } : {}) }],
    updatedAt: now
  };
}

export function createFinding(program: Target | undefined, overrides: Partial<Submission> = {}, now = Date.now()): Submission {
  return {
    id: generateId(),
    title: '',
    targetId: program?.id ?? '',
    platform: (program?.platform ?? 'hackerone') as Platform,
    severity: 'medium',
    status: 'draft',
    payoutIds: [],
    tags: [],
    affectedAssets: [],
    evidenceAssetIds: [],
    timeline: [{ id: generateId(), status: 'draft', at: now }],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

/**
 * Turn a pasted raw request (optionally followed by the response) or curl
 * command into an `http-exchange` evidence asset.
 */
export function evidenceFromHttp(raw: string, targetId: string | undefined, now = Date.now()): EvidenceAsset | null {
  let content = raw.replace(/\r\n/g, '\n').trim();
  if (!content) return null;
  // "Copy as cURL" from browser devtools / Burp: convert to a raw request.
  if (/^curl\s/i.test(content)) {
    const request = parseCurl(content);
    if (!request) return null;
    content = toRawHttp(request).trim();
  }
  const exchange = parseHttpExchange(content);
  if (!exchange) return null;
  const requestRaw = content.slice(0, exchange.responseOffset > 0 ? exchange.responseOffset : content.length).trim();
  const responseRaw = exchange.responseOffset > 0 ? content.slice(exchange.responseOffset).trim() : undefined;
  return {
    id: generateId(),
    title: `${exchange.request.method} ${exchange.request.url}`,
    kind: 'http-exchange',
    source: 'snippet',
    mimeType: 'text/plain',
    size: new Blob([content]).size,
    textContent: content,
    httpExchange: {
      method: exchange.request.method,
      url: exchange.request.url,
      host: hostOfRequest(exchange.request),
      httpVersion: exchange.request.httpVersion,
      statusCode: exchange.response?.statusCode,
      statusText: exchange.response?.statusText,
      requestRaw,
      responseRaw
    },
    targetId: targetId || undefined,
    tags: [],
    syncState: 'synced',
    capturedAt: now,
    createdAt: now,
    updatedAt: now
  };
}
