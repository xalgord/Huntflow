import { describe, expect, it } from 'vitest';
import type { EvidenceAsset, ReconAsset, Session, Submission, Target } from '$lib/types';
import {
  buildEngagementReport,
  clientStatus,
  formatPeriod,
  refPrefix,
  renderEngagementMarkdown,
  truncateLines
} from './engagementReport';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 2, 9);

const program: Target = {
  id: 'p1',
  name: 'Acme Bug Bounty',
  platform: 'hackerone',
  scope: '+ *.acme.com\n- admin.acme.com\nRate limit: 5 rps',
  notes: '',
  priority: 1,
  status: 'testing',
  createdAt: T0,
  updatedAt: T0,
  sessionCount: 2
};

let n = 0;
const finding = (overrides: Partial<Submission>): Submission => ({
  id: `f${++n}`,
  title: 'Finding',
  targetId: 'p1',
  platform: 'hackerone',
  severity: 'medium',
  status: 'draft',
  payoutIds: [],
  tags: [],
  timeline: [],
  createdAt: T0 + n * 1000,
  updatedAt: T0,
  ...overrides
});

const findings = [
  finding({ title: 'Reflected XSS in search', severity: 'medium', cvssScore: 6.1, status: 'submitted' }),
  finding({
    title: 'IDOR on invoice download',
    severity: 'high',
    cvssScore: 7.1,
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:L/A:N',
    cweId: 'CWE-639',
    vulnerabilityType: 'IDOR',
    impact: 'Any customer can download any other customer’s invoices. This exposes names and addresses.',
    stepsToReproduce: '1. Log in\n2. Change the id',
    affectedAssets: ['https://api.acme.com/v1/invoices/{id}'],
    evidenceAssetIds: ['e1'],
    status: 'triaged'
  }),
  finding({ title: 'Verbose server header', severity: 'low', status: 'resolved' }),
  finding({ title: 'Duplicate of known issue', severity: 'critical', status: 'duplicate' }),
  finding({ title: 'Lead: odd redirect', severity: 'informational', status: 'draft' }),
  finding({ title: 'Other program', severity: 'critical', targetId: 'p2' })
];

const sessions: Session[] = [
  { id: 's1', targetId: 'p1', durationPlanned: 3600, durationActual: 5400, startedAt: T0, status: 'completed', tags: [] },
  { id: 's2', targetId: 'p1', durationPlanned: 3600, durationActual: 3600, startedAt: T0 + 3 * DAY, status: 'completed', tags: [] },
  { id: 's3', targetId: 'p1', durationPlanned: 3600, durationActual: 99, startedAt: T0 + 9 * DAY, status: 'abandoned', tags: [] }
];

const assets = [
  { id: 'a1', targetId: 'p1', hostname: 'api.acme.com', url: 'https://api.acme.com', status: 'tested', inScope: true, scopeStatus: 'in-scope', technologies: [] },
  { id: 'a2', targetId: 'p1', hostname: 'admin.acme.com', status: 'out-of-scope', inScope: false, scopeStatus: 'out-of-scope', technologies: [] },
  { id: 'a3', targetId: 'p1', hostname: 'app.acme.com', status: 'untested', inScope: true, technologies: [] }
] as unknown as ReconAsset[];

const evidence = [
  {
    id: 'e1',
    title: 'GET /v1/invoices/991',
    kind: 'http-exchange',
    httpExchange: { method: 'GET', url: '/v1/invoices/991', requestRaw: 'GET /v1/invoices/991 HTTP/1.1\nHost: api.acme.com', responseRaw: 'HTTP/1.1 200 OK' }
  }
] as unknown as EvidenceAsset[];

const data = { findings, assets, sessions, evidence };

describe('engagement report', () => {
  it('orders findings by severity then CVSS and numbers them per program', () => {
    const report = buildEngagementReport(program, data, {}, T0 + 10 * DAY);
    expect(report.findings.map((item) => [item.ref, item.finding.title, item.status])).toEqual([
      ['ACME-01', 'IDOR on invoice download', 'Open'],
      ['ACME-02', 'Reflected XSS in search', 'Open'],
      ['ACME-03', 'Verbose server header', 'Resolved'],
      ['ACME-04', 'Lead: odd redirect', 'Open']
    ]);
    expect(report.counts).toEqual({ critical: 0, high: 1, medium: 1, low: 1, informational: 1 });
    expect(report.overallRisk).toBe('high');
    expect(report.findings[0].evidence.map((asset) => asset.id)).toEqual(['e1']);
  });

  it('respects include options', () => {
    const report = buildEngagementReport(program, data, { includeDrafts: false, includeClosed: true, includeEvidence: false });
    expect(report.findings.map((item) => item.finding.title)).toEqual([
      'Duplicate of known issue',
      'IDOR on invoice download',
      'Reflected XSS in search',
      'Verbose server header'
    ]);
    expect(report.findings.every((item) => item.evidence.length === 0)).toBe(true);
    // Closed findings never drive the risk rating.
    expect(report.overallRisk).toBe('high');
  });

  it('derives period, time, scope and tested assets', () => {
    const report = buildEngagementReport(program, data);
    expect(report.period).toEqual({ start: '2026-11-02', end: '2026-11-05' });
    expect(formatPeriod(report.period)).toBe('November 2, 2026 – November 5, 2026');
    expect(report.time).toEqual({ seconds: 9000, sessions: 2 });
    expect(report.scope).toEqual({ include: ['*.acme.com'], exclude: ['admin.acme.com'] });
    expect(report.testedAssets.map((asset) => asset.hostname)).toEqual(['app.acme.com', 'api.acme.com']);
  });

  it('writes an executive summary that leads with the worst finding', () => {
    const report = buildEngagementReport(program, data, { preparedBy: 'Deepak' });
    expect(report.settings.title).toBe('Acme Bug Bounty Security Assessment');
    expect(report.executiveSummary).toContain('Deepak assessed Acme Bug Bounty between November 2, 2026 and November 5, 2026 over 2.5 hours of testing.');
    expect(report.executiveSummary).toContain('4 findings were identified (1 high, 1 medium, 1 low, 1 informational).');
    expect(report.executiveSummary).toContain('The most significant is ACME-01, IDOR on invoice download: any customer can download any other customer’s invoices.');
    expect(report.executiveSummary).toContain('3 findings remain open, giving an overall risk rating of High.');
  });

  it('uses saved program settings and lets a custom summary win', () => {
    const report = buildEngagementReport({ ...program, report: { title: 'Q4 Web Test', executiveSummary: 'Custom.', periodStart: '2026-10-01' } }, data);
    expect(report.settings.title).toBe('Q4 Web Test');
    expect(report.executiveSummary).toBe('Custom.');
    expect(report.period.start).toBe('2026-10-01');
  });

  it('handles a clean engagement', () => {
    const report = buildEngagementReport(program, { findings: [], assets: [], sessions: [], evidence: [] });
    expect(report.overallRisk).toBeNull();
    expect(report.executiveSummary).toMatch(/No security issues were identified/);
  });

  it('renders the whole report as Markdown', () => {
    const markdown = renderEngagementMarkdown(buildEngagementReport(program, data, { preparedBy: 'Deepak' }, T0 + 10 * DAY));
    expect(markdown).toContain('# Acme Bug Bounty Security Assessment');
    expect(markdown).toContain('**Prepared by:** Deepak');
    expect(markdown).toContain('| ACME-01 | IDOR on invoice download | High | 7.1 | Open |');
    expect(markdown).toContain('### ACME-01: IDOR on invoice download');
    expect(markdown).toContain('| **Weakness** | CWE-639 — IDOR |');
    expect(markdown).toContain('```http\nGET /v1/invoices/991 HTTP/1.1\nHost: api.acme.com\n\nHTTP/1.1 200 OK\n```');
    expect(markdown).toContain('- `admin.acme.com`');
    expect(markdown).not.toContain('Other program');
  });
});

describe('helpers', () => {
  it('builds short reference prefixes', () => {
    expect(refPrefix('Acme Bug Bounty')).toBe('ACME');
    expect(refPrefix('The Globex Public VDP')).toBe('GLOBEX');
    expect(refPrefix('Bug Bounty')).toBe('BUG');
    expect(refPrefix('!!!')).toBe('HF');
  });

  it('maps statuses to client language', () => {
    expect(clientStatus('accepted')).toBe('Open');
    expect(clientStatus('rewarded')).toBe('Resolved');
    expect(clientStatus('not-applicable')).toBe('Closed');
  });

  it('truncates long evidence', () => {
    expect(truncateLines('a\nb\nc', 2)).toBe('a\nb\n… 1 more lines');
    expect(truncateLines('a\nb', 2)).toBe('a\nb');
  });
});
