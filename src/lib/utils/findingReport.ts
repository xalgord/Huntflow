/**
 * Finding → report rendering.
 *
 * Bug bounty platforms don't take one markdown blob: their submission
 * forms have separate fields (asset, weakness, severity, description,
 * impact…). `platformFields` returns exactly those fields so each can be
 * copied straight into the form; `renderFindingMarkdown` produces a full
 * document for email, pentest reports or platforms with a single body.
 */
import { getFindingTemplate, type FindingTemplate } from '$lib/data/findingTemplates';
import type { EvidenceAsset, Note, PayoutSeverity, Platform, Submission } from '$lib/types';
import { calculateCvss, parseCvssVector } from './cvss';
import { parseNoteFields } from './reports';

export type ExportPlatform = 'hackerone' | 'bugcrowd' | 'intigriti' | 'yeswehack' | 'generic';

export const EXPORT_PLATFORMS: Array<{ id: ExportPlatform; label: string }> = [
  { id: 'hackerone', label: 'HackerOne' },
  { id: 'bugcrowd', label: 'Bugcrowd' },
  { id: 'intigriti', label: 'Intigriti' },
  { id: 'yeswehack', label: 'YesWeHack' },
  { id: 'generic', label: 'Markdown' }
];

export function exportPlatformFor(platform: Platform): ExportPlatform {
  if (platform === 'hackerone' || platform === 'bugcrowd' || platform === 'intigriti' || platform === 'yeswehack') {
    return platform;
  }
  return 'generic';
}

export interface ReportContext {
  programName?: string;
  evidence?: EvidenceAsset[];
}

export interface PlatformField {
  id: string;
  label: string;
  value: string;
  /** Rendered as a code block / textarea rather than a single line. */
  multiline?: boolean;
  /** Short help about where this goes in the platform form. */
  hint?: string;
}

const SEVERITY_LABEL: Record<PayoutSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  informational: 'None (Informational)'
};

/** CVSS score → qualitative rating (FIRST v3.1/v4.0 bands). */
export function severityFromCvssScore(score: number): PayoutSeverity {
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  if (score > 0) return 'low';
  return 'informational';
}

const clean = (value: string | undefined): string => (value ?? '').trim();

function evidenceSection(evidence: EvidenceAsset[]): string {
  if (evidence.length === 0) return '';
  const lines: string[] = [];
  for (const asset of evidence) {
    if (asset.kind === 'url' && asset.url) {
      lines.push(`- [${asset.title}](${asset.url})`);
    } else if (asset.kind === 'http-exchange' && asset.httpExchange?.requestRaw) {
      const raw = asset.httpExchange.requestRaw.length > 6000
        ? `${asset.httpExchange.requestRaw.slice(0, 6000)}\n…(truncated)`
        : asset.httpExchange.requestRaw;
      lines.push(`- ${asset.title}`, '', '```http', raw.trimEnd(), '```', '');
    } else if ((asset.kind === 'request' || asset.kind === 'response' || asset.kind === 'text') && asset.textContent) {
      const text = asset.textContent.length > 4000 ? `${asset.textContent.slice(0, 4000)}\n…(truncated)` : asset.textContent;
      lines.push(`- ${asset.title}`, '', '```', text.trimEnd(), '```', '');
    } else {
      lines.push(`- ${asset.title}${asset.fileName ? ` (attached: \`${asset.fileName}\`)` : ''}`);
    }
  }
  return lines.join('\n').trim();
}

function referencesList(references: string | undefined): string {
  return clean(references)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith('-') || line.startsWith('*') ? line : `- ${line}`))
    .join('\n');
}

function assetsText(finding: Submission): string {
  return (finding.affectedAssets ?? []).map((asset) => asset.trim()).filter(Boolean).join(', ');
}

function cvssText(finding: Submission): string {
  const parts: string[] = [];
  if (finding.cvssVector) parts.push(`${finding.cvssVector}${finding.cvssScore != null ? ` (${finding.cvssScore.toFixed(1)})` : ''}`);
  if (finding.cvss4Vector) parts.push(`${finding.cvss4Vector}${finding.cvss4Score != null ? ` (${finding.cvss4Score.toFixed(1)})` : ''}`);
  return parts.join('\n');
}

function weaknessText(finding: Submission): string {
  const parts = [finding.cweId, finding.vulnerabilityType].map(clean).filter(Boolean);
  return parts.join(' — ');
}

function joinSections(sections: Array<[string, string]>, headingLevel = '##'): string {
  return sections
    .filter(([, body]) => clean(body))
    .map(([heading, body]) => `${headingLevel} ${heading}\n\n${body.trim()}`)
    .join('\n\n');
}

/** Exactly the fields each platform's submission form asks for. */
export function platformFields(finding: Submission, platform: ExportPlatform, context: ReportContext = {}): PlatformField[] {
  const evidence = evidenceSection(context.evidence ?? []);
  const refs = referencesList(finding.references);
  const template = getFindingTemplate(finding.templateId);
  const supporting = [evidence, refs].filter(Boolean).join('\n\n');

  switch (platform) {
    case 'hackerone':
      return [
        { id: 'asset', label: 'Asset', value: assetsText(finding), hint: 'Pick the matching in-scope asset' },
        { id: 'weakness', label: 'Weakness', value: weaknessText(finding), hint: 'Search by CWE in the weakness picker' },
        { id: 'severity', label: 'Severity', value: cvssText(finding) || SEVERITY_LABEL[finding.severity], hint: 'Paste the vector into the CVSS calculator' },
        { id: 'title', label: 'Title', value: finding.title },
        {
          id: 'description',
          label: 'Description',
          multiline: true,
          value: joinSections([
            ['Summary', clean(finding.summary)],
            ['Steps To Reproduce', clean(finding.stepsToReproduce)],
            ['Supporting Material/References', supporting]
          ])
        },
        { id: 'impact', label: 'Impact', multiline: true, value: clean(finding.impact) }
      ];
    case 'bugcrowd':
      return [
        { id: 'title', label: 'Summary title', value: finding.title },
        { id: 'target', label: 'Target', value: assetsText(finding) },
        { id: 'vrt', label: 'Vulnerability type (VRT)', value: template?.vrt ?? finding.vulnerabilityType ?? '' },
        { id: 'url', label: 'URL / location', value: (finding.affectedAssets ?? [])[0] ?? '' },
        {
          id: 'description',
          label: 'Description',
          multiline: true,
          value: joinSections([
            ['Description', clean(finding.summary)],
            ['Steps to Reproduce', clean(finding.stepsToReproduce)],
            ['Proof of Concept', evidence],
            ['Impact', clean(finding.impact)],
            ['Suggested Remediation', clean(finding.remediation)],
            ['References', refs]
          ])
        }
      ];
    case 'intigriti':
      return [
        { id: 'title', label: 'Title', value: finding.title },
        { id: 'domain', label: 'Domain / asset', value: assetsText(finding) },
        { id: 'type', label: 'Type', value: weaknessText(finding) },
        { id: 'severity', label: 'Severity', value: cvssText(finding) || SEVERITY_LABEL[finding.severity] },
        { id: 'endpoint', label: 'Endpoint / location', value: (finding.affectedAssets ?? [])[0] ?? '' },
        {
          id: 'poc',
          label: 'Proof of concept',
          multiline: true,
          value: joinSections([
            ['Summary', clean(finding.summary)],
            ['Steps to reproduce', clean(finding.stepsToReproduce)],
            ['Evidence', evidence]
          ])
        },
        { id: 'impact', label: 'Impact', multiline: true, value: clean(finding.impact) },
        {
          id: 'recommendation',
          label: 'Recommendation',
          multiline: true,
          value: joinSections([
            ['Remediation', clean(finding.remediation)],
            ['References', refs]
          ])
        }
      ];
    case 'yeswehack':
      return [
        { id: 'title', label: 'Title', value: finding.title },
        { id: 'scope', label: 'Scope', value: assetsText(finding) },
        { id: 'type', label: 'Vulnerability type', value: weaknessText(finding) },
        { id: 'cvss', label: 'CVSS', value: cvssText(finding) || SEVERITY_LABEL[finding.severity] },
        {
          id: 'description',
          label: 'Description',
          multiline: true,
          value: joinSections([
            ['Description', clean(finding.summary)],
            ['Exploitation', clean(finding.stepsToReproduce)],
            ['PoC', evidence],
            ['Risk', clean(finding.impact)],
            ['Remediation', clean(finding.remediation)],
            ['References', refs]
          ])
        }
      ];
    default:
      return [
        { id: 'title', label: 'Title', value: finding.title },
        { id: 'report', label: 'Report', multiline: true, value: renderFindingMarkdown(finding, context) }
      ];
  }
}

/** A complete, self-contained markdown report for one finding. */
export function renderFindingMarkdown(finding: Submission, context: ReportContext = {}): string {
  const meta: Array<[string, string]> = [
    ['Severity', SEVERITY_LABEL[finding.severity]],
    ['CVSS', cvssText(finding).replace(/\n/g, '<br>')],
    ['Weakness', weaknessText(finding)],
    ['Affected', assetsText(finding)],
    ['Program', clean(context.programName)]
  ].filter(([, value]) => clean(value)) as Array<[string, string]>;

  const table = meta.length
    ? ['| | |', '|---|---|', ...meta.map(([key, value]) => `| **${key}** | ${value.replace(/\|/g, '\\|')} |`)].join('\n')
    : '';

  const body = joinSections([
    ['Summary', clean(finding.summary)],
    ['Steps to Reproduce', clean(finding.stepsToReproduce)],
    ['Impact', clean(finding.impact)],
    ['Remediation', clean(finding.remediation)],
    ['Evidence', evidenceSection(context.evidence ?? [])],
    ['References', referencesList(finding.references)]
  ]);

  return [`# ${finding.title || 'Untitled finding'}`, table, body].filter(Boolean).join('\n\n').trim() + '\n';
}

export interface Completeness {
  missing: string[];
  ready: boolean;
}

/** What a triager will bounce the report for. */
export function reportCompleteness(finding: Submission): Completeness {
  const missing: string[] = [];
  if (!clean(finding.title)) missing.push('Title');
  if (!(finding.affectedAssets ?? []).some((asset) => clean(asset))) missing.push('Affected asset');
  if (!clean(finding.summary)) missing.push('Summary');
  if (!clean(finding.stepsToReproduce)) missing.push('Steps to reproduce');
  if (!clean(finding.impact)) missing.push('Impact');
  const placeholders = [finding.summary, finding.stepsToReproduce, finding.impact, finding.remediation].some((value) =>
    /‹[^›]+›/.test(value ?? '')
  );
  if (placeholders) missing.push('Template placeholders ‹…›');
  return { missing, ready: missing.length === 0 };
}

/** Apply a template's classification and scaffold, never overwriting the hunter's text. */
export function applyFindingTemplate(finding: Submission, template: FindingTemplate): Submission {
  const keep = (current: string | undefined, fallback: string) => (clean(current) ? current : fallback);
  const adoptVector = !clean(finding.cvssVector) && template.cvssVector;
  const metrics = adoptVector ? parseCvssVector(template.cvssVector!) : null;
  const score = metrics ? calculateCvss(metrics).baseScore : finding.cvssScore;
  return {
    ...finding,
    templateId: template.id,
    title: clean(finding.title) ? finding.title : template.name,
    vulnerabilityType: keep(finding.vulnerabilityType, template.vulnerabilityType),
    cweId: keep(finding.cweId, template.cweId ?? ''),
    severity:
      finding.cvssScore != null || finding.cvss4Score != null
        ? finding.severity
        : score != null
          ? severityFromCvssScore(score)
          : template.severity,
    cvssVector: keep(finding.cvssVector, template.cvssVector ?? '') || undefined,
    cvssScore: score,
    summary: keep(finding.summary, template.summary),
    stepsToReproduce: keep(finding.stepsToReproduce, template.stepsToReproduce),
    impact: keep(finding.impact, template.impact),
    remediation: keep(finding.remediation, template.remediation),
    references: keep(finding.references, template.references.join('\n'))
  };
}

/**
 * Findings created before structured fields existed only have free-form
 * `reportMarkdown`. Split it into sections by heading; anything that can't
 * be classified becomes the summary so no text is lost.
 */
export function migrateLegacyReport(finding: Submission): Submission {
  const hasStructured = [finding.summary, finding.stepsToReproduce, finding.impact, finding.remediation].some((value) =>
    clean(value)
  );
  const legacy = clean(finding.reportMarkdown);
  if (hasStructured || !legacy) return finding;

  const parsed = parseNoteFields({ title: finding.title, content: legacy, tags: finding.tags ?? [] });
  const steps = [parsed.reproductionSteps, parsed.proofOfConcept].map(clean).filter(Boolean).join('\n\n');
  const structuredAny = [parsed.reproductionSteps, parsed.impact, parsed.remediation].some((value) => clean(value));
  return {
    ...finding,
    summary: structuredAny ? clean(parsed.summary) : legacy,
    stepsToReproduce: steps || undefined,
    impact: clean(parsed.impact) || undefined,
    remediation: clean(parsed.remediation) || undefined,
    references: clean(parsed.references) || finding.references,
    affectedAssets: finding.affectedAssets?.length
      ? finding.affectedAssets
      : clean(parsed.affectedAsset)
        ? [clean(parsed.affectedAsset)]
        : finding.affectedAssets
  };
}

/** Build a finding from a note promoted while hunting. */
export function findingFieldsFromNote(note: Note): Partial<Submission> {
  const parsed = parseNoteFields(note);
  const steps = [parsed.reproductionSteps, parsed.proofOfConcept].map(clean).filter(Boolean).join('\n\n');
  return {
    title: clean(parsed.title) || note.title,
    summary: clean(parsed.summary) || undefined,
    stepsToReproduce: steps || undefined,
    impact: clean(parsed.impact) || undefined,
    remediation: clean(parsed.remediation) || undefined,
    references: clean(parsed.references) || undefined,
    affectedAssets: clean(parsed.affectedAsset) ? [clean(parsed.affectedAsset)] : undefined,
    vulnerabilityType: clean(parsed.vulnerabilityType) || undefined,
    severity: note.severity ?? parsed.severity,
    cvssVector: note.cvssVector,
    cvssScore: note.cvssScore,
    noteId: note.id
  };
}

// ─── Duplicate detection ──────────────────────────────────────────────────

const STOP_WORDS = new Set(['the', 'a', 'an', 'on', 'in', 'of', 'to', 'via', 'and', 'for', 'with', 'at', 'by', 'is']);

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/https?:\/\//g, ' ')
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
  );
}

function hostOf(value: string): string {
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase();
  } catch {
    return value.toLowerCase();
  }
}

function pathOf(value: string): string {
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).pathname.replace(/\/+$/, '').toLowerCase();
  } catch {
    return '';
  }
}

export interface SimilarFinding {
  finding: Submission;
  score: number;
  reasons: string[];
}

/**
 * Findings in the same program that look like the same bug — the cheapest
 * way to avoid submitting your own duplicate (or re-reporting a known one).
 */
export function findSimilarFindings(finding: Submission, all: Submission[], threshold = 0.45): SimilarFinding[] {
  const titleTokens = tokens(finding.title);
  const assets = (finding.affectedAssets ?? []).map((asset) => asset.trim()).filter(Boolean);
  const results: SimilarFinding[] = [];

  for (const other of all) {
    if (other.id === finding.id || other.targetId !== finding.targetId) continue;
    const reasons: string[] = [];
    let score = 0;

    const otherTokens = tokens(other.title);
    const overlap = [...titleTokens].filter((token) => otherTokens.has(token)).length;
    const union = new Set([...titleTokens, ...otherTokens]).size || 1;
    const jaccard = overlap / union;
    if (jaccard >= 0.3) {
      score += jaccard * 0.6;
      reasons.push('similar title');
    }

    const sameType =
      clean(finding.vulnerabilityType).toLowerCase() &&
      clean(finding.vulnerabilityType).toLowerCase() === clean(other.vulnerabilityType).toLowerCase();
    const sameCwe = clean(finding.cweId) && clean(finding.cweId) === clean(other.cweId);
    if (sameType || sameCwe) {
      score += 0.25;
      reasons.push(sameCwe ? `same weakness (${finding.cweId})` : `same type (${finding.vulnerabilityType})`);
    }

    const otherAssets = (other.affectedAssets ?? []).map((asset) => asset.trim()).filter(Boolean);
    const sharedEndpoint = assets.some((asset) =>
      otherAssets.some((candidate) => hostOf(asset) === hostOf(candidate) && pathOf(asset) !== '' && pathOf(asset) === pathOf(candidate))
    );
    const sharedHost = !sharedEndpoint && assets.some((asset) => otherAssets.some((candidate) => hostOf(asset) === hostOf(candidate)));
    if (sharedEndpoint) {
      score += 0.45;
      reasons.push('same endpoint');
    } else if (sharedHost) {
      score += 0.15;
      reasons.push('same host');
    }

    if (score >= threshold) results.push({ finding: other, score: Math.min(1, score), reasons });
  }

  return results.sort((a, b) => b.score - a.score);
}
