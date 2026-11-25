import { describe, expect, it } from 'vitest';
import { FINDING_TEMPLATES, getFindingTemplate, searchFindingTemplates } from '$lib/data/findingTemplates';
import type { EvidenceAsset, Submission } from '$lib/types';
import { buildCvss4Vector, CVSS4_DEFAULTS, parseCvss4Vector, scoreCvss4 } from './cvss4';
import {
  applyFindingTemplate,
  findSimilarFindings,
  migrateLegacyReport,
  platformFields,
  renderFindingMarkdown,
  reportCompleteness,
  severityFromCvssScore
} from './findingReport';

function finding(partial: Partial<Submission> = {}): Submission {
  return {
    id: 'f1',
    title: 'IDOR on /api/orders/{id}',
    targetId: 'p1',
    platform: 'hackerone',
    severity: 'high',
    status: 'draft',
    payoutIds: [],
    tags: [],
    timeline: [],
    createdAt: 1,
    updatedAt: 1,
    ...partial
  };
}

const complete = finding({
  affectedAssets: ['https://api.acme.test/api/orders/123'],
  vulnerabilityType: 'IDOR',
  cweId: 'CWE-639',
  cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:L/A:N',
  cvssScore: 7.1,
  summary: 'Orders can be read across accounts.',
  stepsToReproduce: '1. Sign in as A\n2. Request B\'s order',
  impact: 'Any user can read every order.',
  remediation: 'Check ownership.',
  references: 'https://cwe.mitre.org/data/definitions/639.html'
});

describe('finding templates', () => {
  it('have unique ids and complete scaffolds', () => {
    const ids = new Set(FINDING_TEMPLATES.map((template) => template.id));
    expect(ids.size).toBe(FINDING_TEMPLATES.length);
    for (const template of FINDING_TEMPLATES) {
      expect(template.summary && template.stepsToReproduce && template.impact && template.remediation).toBeTruthy();
      if (template.cweId) expect(template.cweId).toMatch(/^CWE-\d+$/);
      if (template.cvssVector) expect(template.cvssVector).toMatch(/^CVSS:3\.1\//);
    }
  });

  it('searches by keyword and CWE', () => {
    expect(searchFindingTemplates('bola object')[0].id).toBe('idor');
    expect(searchFindingTemplates('CWE-918')[0].id).toBe('ssrf');
    expect(searchFindingTemplates('')).toHaveLength(FINDING_TEMPLATES.length);
  });
});

describe('applyFindingTemplate', () => {
  it('fills empty fields but never overwrites the hunter\'s text', () => {
    const template = getFindingTemplate('idor')!;
    const result = applyFindingTemplate(finding({ title: 'My title', impact: 'Mine' }), template);
    expect(result.title).toBe('My title');
    expect(result.impact).toBe('Mine');
    expect(result.summary).toBe(template.summary);
    expect(result.cweId).toBe('CWE-639');
    expect(result.templateId).toBe('idor');
    // The template's vector is scored so exports carry the number.
    expect(result.cvssScore).toBe(7.1);
    expect(result.severity).toBe('high');
  });
});

describe('platformFields', () => {
  it('splits HackerOne description and impact into separate fields', () => {
    const fields = platformFields(complete, 'hackerone');
    expect(fields.map((field) => field.id)).toEqual(['asset', 'weakness', 'severity', 'title', 'description', 'impact']);
    const description = fields.find((field) => field.id === 'description')!.value;
    expect(description).toContain('## Summary');
    expect(description).toContain('## Steps To Reproduce');
    expect(description).not.toContain('Any user can read every order');
    expect(fields.find((field) => field.id === 'weakness')!.value).toBe('CWE-639 — IDOR');
    expect(fields.find((field) => field.id === 'severity')!.value).toContain('(7.1)');
  });

  it('uses the Bugcrowd VRT category from the template', () => {
    const fields = platformFields({ ...complete, templateId: 'idor' }, 'bugcrowd');
    expect(fields.find((field) => field.id === 'vrt')!.value).toContain('Insecure Direct Object References');
  });

  it('embeds HTTP evidence as fenced blocks', () => {
    const evidence = [
      {
        id: 'e1',
        title: 'Request for order 123',
        kind: 'http-exchange',
        httpExchange: { method: 'GET', url: 'https://api.acme.test/api/orders/123', requestRaw: 'GET /api/orders/123 HTTP/1.1\nHost: api.acme.test' }
      } as unknown as EvidenceAsset
    ];
    const markdown = renderFindingMarkdown(complete, { evidence, programName: 'Acme' });
    expect(markdown).toContain('```http\nGET /api/orders/123 HTTP/1.1');
    expect(markdown).toContain('| **Program** | Acme |');
    expect(markdown.startsWith('# IDOR on /api/orders/{id}')).toBe(true);
  });
});

describe('reportCompleteness', () => {
  it('lists what triage will bounce', () => {
    expect(reportCompleteness(finding()).missing).toEqual(['Affected asset', 'Summary', 'Steps to reproduce', 'Impact']);
    expect(reportCompleteness(complete).ready).toBe(true);
    expect(reportCompleteness({ ...complete, impact: 'Exposes ‹data type›' }).missing).toContain('Template placeholders ‹…›');
  });
});

describe('migrateLegacyReport', () => {
  it('splits headed markdown into fields', () => {
    const result = migrateLegacyReport(
      finding({ reportMarkdown: '# Summary\nLeak\n\n# Steps to reproduce\n1. Go\n\n# Impact\nBad\n\n# Suggested fix\nFix it' })
    );
    expect(result.summary).toBe('Leak');
    expect(result.stepsToReproduce).toContain('1. Go');
    expect(result.impact).toBe('Bad');
  });

  it('keeps unstructured text as the summary and leaves structured findings alone', () => {
    expect(migrateLegacyReport(finding({ reportMarkdown: 'Just some notes' })).summary).toBe('Just some notes');
    const structured = finding({ summary: 'S', reportMarkdown: '# Impact\nX' });
    expect(migrateLegacyReport(structured)).toBe(structured);
  });
});

describe('findSimilarFindings', () => {
  it('flags same-endpoint findings in the same program only', () => {
    const others = [
      finding({ id: 'dup', title: 'Order IDOR lets users read others orders', vulnerabilityType: 'IDOR', affectedAssets: ['api.acme.test/api/orders/9'] }),
      finding({ id: 'other-program', targetId: 'p2', title: complete.title, affectedAssets: complete.affectedAssets }),
      finding({ id: 'unrelated', title: 'Reflected XSS in search', vulnerabilityType: 'Reflected XSS', affectedAssets: ['https://www.acme.test/search'] })
    ];
    const similar = findSimilarFindings({ ...complete, affectedAssets: ['https://api.acme.test/api/orders/9'] }, others);
    expect(similar.map((item) => item.finding.id)).toEqual(['dup']);
    expect(similar[0].reasons).toContain('same endpoint');
  });
});

describe('CVSS', () => {
  it('maps scores to FIRST rating bands', () => {
    expect([9.8, 7, 6.9, 0.1, 0].map(severityFromCvssScore)).toEqual(['critical', 'high', 'medium', 'low', 'informational']);
  });

  it('round-trips v4.0 vectors', () => {
    const vector = buildCvss4Vector({ ...CVSS4_DEFAULTS, VC: 'H', VI: 'H', VA: 'H' });
    expect(vector).toBe('CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N');
    expect(parseCvss4Vector(vector)).toMatchObject({ VC: 'H', SA: 'N' });
    expect(parseCvss4Vector('CVSS:3.1/AV:N')).toBeNull();
    expect(parseCvss4Vector('CVSS:4.0/AV:X/AC:L')).toBeNull();
  });

  it('scores v4.0 vectors with the FIRST algorithm', async () => {
    expect(await scoreCvss4('CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N')).toBe(9.3);
    expect(await scoreCvss4('CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:L/VI:L/VA:N/SC:N/SI:N/SA:N')).toBe(5.3);
    expect(await scoreCvss4('not a vector')).toBeNull();
  });
});
