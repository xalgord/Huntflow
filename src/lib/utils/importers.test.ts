// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ReconAsset, Submission, Target } from '$lib/types';
import { classifyScope, detectImportKind, hostFromValue, mergeScopeText, parseCsv, parseImport } from './importers';
import { describePlan, planImport } from './importPlan';

const fixture = (name: string) => readFileSync(resolve(__dirname, '../../../tests/fixtures/imports', name), 'utf8');

const program = (scope = ''): Target =>
  ({
    id: 'prog-1',
    name: 'Acme',
    platform: 'hackerone',
    scope,
    createdAt: 0,
    updatedAt: 0
  }) as unknown as Target;

describe('detectImportKind', () => {
  it.each([
    ['h1-scope.csv', 'h1-scope-csv'],
    ['bugcrowd-scope.txt', 'scope-text'],
    ['subfinder.txt', 'hosts'],
    ['subfinder.jsonl', 'hosts'],
    ['httpx.jsonl', 'httpx'],
    ['httpx.txt', 'httpx'],
    ['nuclei.jsonl', 'nuclei'],
    ['nmap.xml', 'nmap'],
    ['burp.xml', 'burp']
  ])('recognises %s', (file, kind) => {
    expect(detectImportKind(fixture(file), file)).toBe(kind);
  });
});

describe('helpers', () => {
  it('extracts hosts from URLs, wildcards and noise', () => {
    expect(hostFromValue('https://App.Acme.com/login?x=1')).toBe('app.acme.com');
    expect(hostFromValue('*.acme.com')).toBe('acme.com');
    expect(hostFromValue('api.acme.com:8443')).toBe('api.acme.com');
    expect(hostFromValue('10.0.0.1')).toBe('10.0.0.1');
    expect(hostFromValue('not a host')).toBeNull();
    expect(hostFromValue('')).toBeNull();
  });

  it('parses quoted CSV fields with commas, quotes and newlines', () => {
    expect(parseCsv('a,b\n"x, y","he said ""hi""\nthere"\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'he said "hi"\nthere']
    ]);
  });

  it('appends only new scope rules under a dated heading', () => {
    const merged = mergeScopeText('*.acme.com\n- blog.acme.com', ['*.acme.com', 'api.acme.com'], ['blog.acme.com', 'status.acme.com'], 'Imported');
    expect(merged).toBe('*.acme.com\n- blog.acme.com\n\n# Imported\napi.acme.com\n- status.acme.com');
    expect(mergeScopeText('a.com', ['a.com'], [], 'x')).toBe('a.com');
    expect(mergeScopeText('', ['a.com'], [], 'x')).toBe('# x\na.com');
  });
});

describe('parseImport', () => {
  it('reads HackerOne structured scope', () => {
    const result = parseImport(fixture('h1-scope.csv'));
    expect(result.scope.include).toEqual(['*.acme.com', 'api.acme.com', 'https://app.acme.com', '10.20.0.0/16']);
    expect(result.scope.exclude).toEqual(['status.acme.com']);
    const byHost = Object.fromEntries(result.assets.map((asset) => [asset.hostname, asset]));
    expect(Object.keys(byHost)).toEqual(['api.acme.com', 'app.acme.com', 'status.acme.com', 'com.acme.android', '10.20.0.0/16']);
    expect(byHost['api.acme.com'].notes).toContain('Primary REST API');
    expect(byHost['status.acme.com']).toMatchObject({ scopeStatus: 'out-of-scope' });
    expect(byHost['status.acme.com'].notes).toContain('Not eligible for bounty');
    expect(byHost['com.acme.android'].assetType).toBe('mobile');
    expect(byHost['app.acme.com'].url).toBe('https://app.acme.com');
  });

  it('reads pasted Bugcrowd-style scope tables', () => {
    const result = parseImport(fixture('bugcrowd-scope.txt'));
    expect(result.scope.include).toEqual(['*.acme.com', 'api.acme.com', 'https://portal.acme.com/app']);
    expect(result.scope.exclude).toEqual(['blog.acme.com', '*.staging.acme.com']);
    expect(result.assets.map((asset) => [asset.hostname, asset.scopeStatus])).toEqual([
      ['api.acme.com', 'in-scope'],
      ['portal.acme.com', 'in-scope'],
      ['blog.acme.com', 'out-of-scope']
    ]);
  });

  it('reads subfinder text and JSON lines, deduping case-insensitively', () => {
    expect(parseImport(fixture('subfinder.txt')).assets.map((asset) => asset.hostname)).toEqual([
      'api.acme.com',
      'dev.acme.com',
      'blog.acme.com',
      'mail.acme.com'
    ]);
    expect(parseImport(fixture('subfinder.jsonl')).assets.map((asset) => asset.hostname)).toEqual(['api.acme.com', 'cdn.acme.com']);
  });

  it('reads httpx JSON with title, status, tech, IP and port', () => {
    const [api, dev] = parseImport(fixture('httpx.jsonl')).assets;
    expect(api).toMatchObject({
      hostname: 'api.acme.com',
      url: 'https://api.acme.com',
      title: 'Acme API',
      httpStatus: 200,
      ipAddress: '104.18.2.3',
      ports: [443],
      source: 'httpx'
    });
    expect(api.technologies).toEqual(['Cloudflare', 'Express', 'nginx']);
    expect(dev).toMatchObject({ httpStatus: 403, ipAddress: '10.0.0.5' });
  });

  it('reads httpx default text output', () => {
    const assets = parseImport(fixture('httpx.txt')).assets;
    expect(assets[0]).toMatchObject({ hostname: 'api.acme.com', httpStatus: 200, title: 'Acme API', technologies: ['Cloudflare', 'Express'] });
    expect(assets[1].technologies).toEqual(['Apache', 'PHP:7.4']);
    expect(assets[2]).toMatchObject({ hostname: 'blog.acme.com', httpStatus: 301, technologies: [] });
  });

  it('turns nuclei results into draft findings with evidence, once per template and location', () => {
    const result = parseImport(fixture('nuclei.jsonl'));
    expect(result.findings).toHaveLength(1);
    const [git] = result.findings;
    expect(git).toMatchObject({
      sourceKey: 'nuclei:git-config:https://dev.acme.com/.git/config',
      title: 'Git Configuration - Detect on dev.acme.com',
      severity: 'medium',
      cweId: 'CWE-200',
      cvssScore: 5.3,
      remediation: 'Block access to the .git directory.',
      references: 'https://example.org/git-exposure',
      affectedAssets: ['https://dev.acme.com/.git/config']
    });
    expect(git.httpEvidence).toContain('GET /.git/config HTTP/1.1');
    expect(git.httpEvidence).toContain('HTTP/1.1 200 OK');
    expect(git.summary).toContain('Verify manually');
  });

  it('records info-level nuclei hits as technologies, not findings', () => {
    const result = parseImport(fixture('nuclei.jsonl'));
    expect(result.findings.some((finding) => finding.severity === 'informational')).toBe(false);
    const api = result.assets.find((asset) => asset.hostname === 'api.acme.com');
    expect(api).toMatchObject({ url: 'https://api.acme.com', technologies: ['nginx'], source: 'nuclei' });
    expect(result.assets.map((asset) => asset.hostname)).toEqual(['dev.acme.com', 'api.acme.com']);
  });

  it('reads nmap XML: live hosts, open ports and service versions only', () => {
    const assets = parseImport(fixture('nmap.xml')).assets;
    expect(assets).toHaveLength(2);
    expect(assets[0]).toMatchObject({
      hostname: 'api.acme.com',
      ipAddress: '93.184.216.34',
      ports: [22, 443],
      technologies: ['nginx 1.25.3', 'OpenSSH 9.6'],
      notes: 'Also known as edge.acme.com',
      source: 'nmap'
    });
    expect(assets[1]).toMatchObject({ hostname: '10.20.1.7', ports: [8080], technologies: ['http-proxy'] });
  });

  it('reads Burp issue exports with decoded request/response evidence', () => {
    const result = parseImport(fixture('burp.xml'));
    expect(result.findings).toHaveLength(1);
    const [xss] = result.findings;
    expect(xss).toMatchObject({
      title: 'Cross-site scripting (reflected) on app.acme.com',
      severity: 'high',
      cweId: 'CWE-79',
      references: 'https://portswigger.net/web-security/cross-site-scripting/reflected',
      affectedAssets: ['https://app.acme.com/search']
    });
    expect(xss.summary).toContain('The value of the q request parameter is copied');
    expect(xss.remediation).toBe('Encode output & validate input.');
    expect(xss.httpEvidence).toContain('GET /search?q=%3Cscript%3E HTTP/1.1');
    expect(xss.httpEvidence).toContain('HTTP/1.1 200 OK');
    expect(result.assets[0]).toMatchObject({ hostname: 'app.acme.com', ipAddress: '93.184.216.40', source: 'burp' });
  });

  it('reports a warning instead of throwing on junk', () => {
    expect(parseImport('hello world', 'nmap').warnings).toHaveLength(1);
    expect(parseImport('{"oops":', 'nuclei').warnings).toHaveLength(1);
    expect(parseImport('', 'hosts').warnings).toHaveLength(1);
  });
});

describe('classifyScope', () => {
  it('flags tool output against the program scope', () => {
    const result = classifyScope(parseImport(fixture('subfinder.txt')), '*.acme.com\n- blog.acme.com');
    expect(Object.fromEntries(result.assets.map((asset) => [asset.hostname, asset.scopeStatus]))).toEqual({
      'api.acme.com': 'in-scope',
      'dev.acme.com': 'in-scope',
      'blog.acme.com': 'out-of-scope',
      'mail.acme.com': 'in-scope'
    });
  });

  it('leaves assets unknown when the program has no rules', () => {
    const result = classifyScope(parseImport(fixture('subfinder.txt')), '');
    expect(result.assets.every((asset) => asset.scopeStatus === undefined)).toBe(true);
  });
});

describe('planImport', () => {
  const options = { includeOutOfScope: false, createFindings: true, updateScope: true };
  const existing: ReconAsset = {
    id: 'a1',
    targetId: 'prog-1',
    hostname: 'api.acme.com',
    status: 'in-progress',
    inScope: true,
    scopeStatus: 'in-scope',
    technologies: ['GraphQL'],
    tags: ['auth'],
    discoveredAt: 1,
    createdAt: 1,
    updatedAt: 1
  };

  it('adds new hosts, enriches existing ones and skips out-of-scope', () => {
    const plan = planImport(parseImport(fixture('httpx.txt')), program('*.acme.com\n- blog.acme.com'), [existing], [], options, 100);
    expect(plan.newAssets.map((asset) => asset.hostname)).toEqual(['dev.acme.com']);
    expect(plan.newAssets[0]).toMatchObject({ targetId: 'prog-1', status: 'untested', scopeStatus: 'in-scope', source: 'httpx' });
    expect(plan.updatedAssets).toHaveLength(1);
    expect(plan.updatedAssets[0]).toMatchObject({
      id: 'a1',
      status: 'in-progress',
      tags: ['auth'],
      httpStatus: 200,
      technologies: ['GraphQL', 'Cloudflare', 'Express'],
      updatedAt: 100
    });
    expect(plan.skipped.outOfScope).toBe(1);
    expect(describePlan(plan)).toBe('1 new target, 1 updated');
  });

  it('keeps out-of-scope hosts flagged when asked', () => {
    const plan = planImport(parseImport(fixture('subfinder.txt')), program('*.acme.com\n- blog.acme.com'), [], [], { ...options, includeOutOfScope: true }, 1);
    const blog = plan.newAssets.find((asset) => asset.hostname === 'blog.acme.com');
    expect(blog).toMatchObject({ scopeStatus: 'out-of-scope', status: 'out-of-scope', inScope: false });
  });

  it('reports unchanged assets on a repeat import', () => {
    const first = planImport(parseImport(fixture('httpx.jsonl')), program(), [], [], options, 1);
    const again = planImport(parseImport(fixture('httpx.jsonl')), program(), first.newAssets, [], options, 2);
    expect(again.newAssets).toHaveLength(0);
    expect(again.updatedAssets).toHaveLength(0);
    expect(again.skipped.unchanged).toBe(2);
    expect(describePlan(again)).toBe('Nothing new to import');
  });

  it('creates draft findings with linked HTTP evidence and never duplicates them', () => {
    const plan = planImport(parseImport(fixture('nuclei.jsonl')), program(), [], [], options, 5);
    expect(plan.findings).toHaveLength(1);
    const [git] = plan.findings;
    expect(git).toMatchObject({ status: 'draft', targetId: 'prog-1', importKey: 'nuclei:git-config:https://dev.acme.com/.git/config', tags: ['nuclei'] });
    expect(git.cvssVector).toBe('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N');
    expect(plan.evidence).toHaveLength(1);
    expect(plan.evidence[0]).toMatchObject({ kind: 'http-exchange', targetId: 'prog-1' });
    expect(plan.evidence[0].httpExchange).toMatchObject({ method: 'GET', statusCode: 200 });
    expect(git.evidenceAssetIds).toEqual([plan.evidence[0].id]);

    const again = planImport(parseImport(fixture('nuclei.jsonl')), program(), [], plan.findings as Submission[], options, 6);
    expect(again.findings).toHaveLength(0);
    expect(again.skipped.existingFindings).toBe(1);
  });

  it('skips findings when the option is off', () => {
    const plan = planImport(parseImport(fixture('burp.xml')), program(), [], [], { ...options, createFindings: false }, 1);
    expect(plan.findings).toHaveLength(0);
    expect(plan.newAssets).toHaveLength(1);
  });

  it('merges imported scope into the program and classifies with it', () => {
    const plan = planImport(parseImport(fixture('h1-scope.csv')), program('# Program rules\n*.acme.com'), [], [], options, Date.UTC(2026, 10, 26));
    expect(plan.scopeText).toBe(
      '# Program rules\n*.acme.com\n\n# Imported 2026-11-26\napi.acme.com\nhttps://app.acme.com\n10.20.0.0/16\n- status.acme.com'
    );
    // Scope sources are authoritative: excluded assets are kept, flagged.
    expect(plan.newAssets.find((asset) => asset.hostname === 'status.acme.com')).toMatchObject({ scopeStatus: 'out-of-scope' });
    expect(describePlan(plan)).toBe('5 new targets, scope rules updated');
  });

  it('does not touch scope when the option is off', () => {
    const plan = planImport(parseImport(fixture('bugcrowd-scope.txt')), program('*.acme.com'), [], [], { ...options, updateScope: false }, 1);
    expect(plan.scopeText).toBeUndefined();
  });
});

describe('large imports', () => {
  it('handles a 30k-line subfinder run against 10k existing targets quickly', () => {
    const hosts = Array.from({ length: 30000 }, (_, index) => `h${index}.acme.com`).join('\n');
    const existing = Array.from({ length: 10000 }, (_, index) => ({
      id: `e${index}`,
      targetId: 'prog-1',
      hostname: `h${index}.acme.com`,
      assetType: 'web',
      status: 'untested',
      inScope: true,
      scopeStatus: 'in-scope',
      technologies: [],
      discoveredAt: 1,
      createdAt: 1,
      updatedAt: 1
    })) as ReconAsset[];
    const started = performance.now();
    const plan = planImport(parseImport(hosts), program('*.acme.com'), existing, [], { includeOutOfScope: false, createFindings: true, updateScope: true }, 2);
    expect(plan.newAssets).toHaveLength(20000);
    expect(plan.skipped.unchanged).toBe(10000);
    expect(performance.now() - started).toBeLessThan(3000);
  });
});
