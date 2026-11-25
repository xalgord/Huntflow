/**
 * Engagement report: everything about one program in one client-ready
 * document — cover, executive summary, scope, findings table, detailed
 * findings and appendices. Pure: the page renders it to HTML for print/PDF
 * and `renderEngagementMarkdown` produces the same report as Markdown.
 */
import type {
  EngagementReportSettings,
  EvidenceAsset,
  PayoutSeverity,
  ReconAsset,
  Session,
  Submission,
  SubmissionStatus,
  Target
} from '$lib/types';
import { parseScopeRules } from './scopeValidator';

export const SEVERITY_ORDER: PayoutSeverity[] = ['critical', 'high', 'medium', 'low', 'informational'];

export const SEVERITY_NAMES: Record<PayoutSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  informational: 'Informational'
};

export type ClientStatus = 'Open' | 'Resolved' | 'Closed';

const CLOSED: SubmissionStatus[] = ['duplicate', 'informational', 'not-applicable', 'closed'];

export function clientStatus(status: SubmissionStatus): ClientStatus {
  if (status === 'resolved' || status === 'rewarded') return 'Resolved';
  if (CLOSED.includes(status)) return 'Closed';
  return 'Open';
}

export interface ReportFinding {
  /** Stable reference like "ACME-03", in report order. */
  ref: string;
  finding: Submission;
  status: ClientStatus;
  evidence: EvidenceAsset[];
}

export interface EngagementReport {
  settings: Required<Pick<EngagementReportSettings, 'title' | 'preparedFor' | 'preparedBy' | 'classification'>> &
    EngagementReportSettings;
  program: Target;
  period: { start?: string; end?: string };
  generatedAt: number;
  findings: ReportFinding[];
  counts: Record<PayoutSeverity, number>;
  openCounts: Record<PayoutSeverity, number>;
  /** Highest severity among open findings, or null when nothing is open. */
  overallRisk: PayoutSeverity | null;
  scope: { include: string[]; exclude: string[] };
  testedAssets: ReconAsset[];
  time: { seconds: number; sessions: number };
  executiveSummary: string;
}

export const DEFAULT_REPORT_SETTINGS: Required<
  Pick<EngagementReportSettings, 'includeDrafts' | 'includeClosed' | 'includeEvidence' | 'findingPerPage' | 'classification'>
> = {
  includeDrafts: true,
  includeClosed: false,
  includeEvidence: true,
  findingPerPage: true,
  classification: 'Confidential'
};

function emptyCounts(): Record<PayoutSeverity, number> {
  return { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
}

export function refPrefix(name: string): string {
  const all = name.replace(/[^A-Za-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  const words = all.filter((word) => !/^(bug|bounty|program|public|private|vdp|inc|corp|ltd|the)$/i.test(word));
  const base = words[0] ?? all[0] ?? '';
  return (base.replace(/[^A-Za-z0-9]/g, '').slice(0, 6) || 'HF').toUpperCase();
}

/** Local calendar day as yyyy-mm-dd (what the tester saw on their clock). */
export function isoDay(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatReportDate(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export function formatPeriod(period: { start?: string; end?: string }): string {
  if (period.start && period.end && period.start !== period.end) return `${formatReportDate(period.start)} – ${formatReportDate(period.end)}`;
  return formatReportDate(period.start ?? period.end);
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function firstSentence(text: string | undefined): string {
  const clean = (text ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const match = clean.match(/^(.{20,240}?[.!?])(\s|$)/);
  return match ? match[1] : clean.slice(0, 240);
}

export function generateExecutiveSummary(report: Omit<EngagementReport, 'executiveSummary'>): string {
  const { findings, counts, overallRisk, settings, program, period, time } = report;
  const when = formatPeriod(period);
  const span = when ? (when.includes(' – ') ? ` between ${when.replace(' – ', ' and ')}` : ` on ${when}`) : '';
  const hours = time.seconds >= 3600 ? ` over ${Math.round(time.seconds / 360) / 10} hours of testing` : '';
  const intro = settings.preparedBy
    ? `${settings.preparedBy} assessed ${program.name}${span}${hours}.`
    : `${program.name} was assessed${span}${hours}.`;
  if (findings.length === 0) {
    return `${intro} No security issues were identified within the tested scope.`;
  }
  const breakdown = SEVERITY_ORDER.filter((severity) => counts[severity] > 0)
    .map((severity) => `${counts[severity]} ${SEVERITY_NAMES[severity].toLowerCase()}`)
    .join(', ');
  const top = findings[0];
  const topImpact = firstSentence(top.finding.impact || top.finding.summary);
  const open = findings.filter((item) => item.status === 'Open').length;
  return [
    `${intro} ${plural(findings.length, 'finding')} ${findings.length === 1 ? 'was' : 'were'} identified (${breakdown}).`,
    `The most significant is ${top.ref}, ${top.finding.title}${topImpact ? `: ${topImpact.replace(/^[A-Z](?=[a-z])/, (letter) => letter.toLowerCase())}` : '.'}`,
    overallRisk
      ? `${plural(open, 'finding')} ${open === 1 ? 'remains' : 'remain'} open, giving an overall risk rating of ${SEVERITY_NAMES[overallRisk]}. Remediation guidance is provided for each finding.`
      : 'All findings have been resolved or closed.'
  ].join(' ');
}

export function buildEngagementReport(
  program: Target,
  data: { findings: Submission[]; assets: ReconAsset[]; sessions: Session[]; evidence: EvidenceAsset[] },
  overrides: EngagementReportSettings = {},
  now = Date.now()
): EngagementReport {
  const saved = { ...DEFAULT_REPORT_SETTINGS, ...(program.report ?? {}), ...overrides };
  const settings = {
    ...saved,
    title: saved.title?.trim() || `${program.name} Security Assessment`,
    preparedFor: saved.preparedFor?.trim() || program.name,
    preparedBy: saved.preparedBy?.trim() ?? '',
    classification: saved.classification?.trim() ?? DEFAULT_REPORT_SETTINGS.classification
  };

  const evidenceById = new Map(data.evidence.map((asset) => [asset.id, asset]));
  const prefix = refPrefix(program.name);
  const included = data.findings
    .filter((finding) => finding.targetId === program.id)
    .filter((finding) => settings.includeDrafts || finding.status !== 'draft')
    .filter((finding) => settings.includeClosed || clientStatus(finding.status) !== 'Closed')
    .sort(
      (a, b) =>
        SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
        (b.cvssScore ?? b.cvss4Score ?? 0) - (a.cvssScore ?? a.cvss4Score ?? 0) ||
        a.createdAt - b.createdAt
    );
  const findings: ReportFinding[] = included.map((finding, index) => ({
    ref: `${prefix}-${String(index + 1).padStart(2, '0')}`,
    finding,
    status: clientStatus(finding.status),
    evidence: settings.includeEvidence
      ? (finding.evidenceAssetIds ?? []).map((id) => evidenceById.get(id)).filter((asset): asset is EvidenceAsset => Boolean(asset))
      : []
  }));

  const counts = emptyCounts();
  const openCounts = emptyCounts();
  for (const item of findings) {
    counts[item.finding.severity] += 1;
    if (item.status === 'Open') openCounts[item.finding.severity] += 1;
  }
  const overallRisk = SEVERITY_ORDER.find((severity) => openCounts[severity] > 0) ?? null;

  const rules = parseScopeRules(program.scope ?? '').filter((rule) => rule.pattern.type !== 'unknown');
  const strip = (raw: string) => raw.replace(/^\s*(?:[-!+]|in:|out:)\s*/i, '');
  const sessions = data.sessions.filter((session) => session.targetId === program.id && session.status === 'completed');
  const sessionDays = sessions.map((session) => session.startedAt).sort((a, b) => a - b);
  const findingDays = included.map((finding) => finding.createdAt).sort((a, b) => a - b);
  const firstDay = sessionDays[0] ?? findingDays[0];
  const lastDay = sessionDays[sessionDays.length - 1] ?? findingDays[findingDays.length - 1];

  const testedAssets = data.assets
    .filter((asset) => asset.targetId === program.id && asset.scopeStatus !== 'out-of-scope' && asset.status !== 'out-of-scope')
    .sort((a, b) => (a.url ?? a.hostname).localeCompare(b.url ?? b.hostname));

  const base: Omit<EngagementReport, 'executiveSummary'> = {
    settings,
    program,
    period: {
      start: settings.periodStart || (firstDay ? isoDay(firstDay) : undefined),
      end: settings.periodEnd || (lastDay ? isoDay(lastDay) : undefined)
    },
    generatedAt: now,
    findings,
    counts,
    openCounts,
    overallRisk,
    scope: {
      include: rules.filter((rule) => rule.kind === 'include').map((rule) => strip(rule.raw)),
      exclude: rules.filter((rule) => rule.kind === 'exclude').map((rule) => strip(rule.raw))
    },
    testedAssets,
    time: { seconds: sessions.reduce((sum, session) => sum + (session.durationActual || 0), 0), sessions: sessions.length }
  };
  return { ...base, executiveSummary: settings.executiveSummary?.trim() || generateExecutiveSummary(base) };
}

function cvssLine(finding: Submission): string {
  const parts: string[] = [];
  if (finding.cvssScore != null) parts.push(`${finding.cvssScore.toFixed(1)}${finding.cvssVector ? ` (${finding.cvssVector})` : ''}`);
  if (finding.cvss4Score != null) parts.push(`${finding.cvss4Score.toFixed(1)}${finding.cvss4Vector ? ` (${finding.cvss4Vector})` : ''}`);
  return parts.join(' · ');
}

export function findingFacts(item: ReportFinding): Array<[string, string]> {
  const { finding } = item;
  return (
    [
      ['Severity', SEVERITY_NAMES[finding.severity]],
      ['CVSS', cvssLine(finding)],
      ['Weakness', [finding.cweId, finding.vulnerabilityType].filter(Boolean).join(' — ')],
      ['Status', item.status + (finding.retestStatus ? ` · retest ${finding.retestStatus.replace(/-/g, ' ')}` : '')],
      ['Affected', (finding.affectedAssets ?? []).filter(Boolean).join('\n')]
    ] as Array<[string, string]>
  ).filter(([, value]) => value.trim());
}

export function findingSections(finding: Submission): Array<[string, string]> {
  return (
    [
      ['Description', finding.summary ?? ''],
      ['Steps to Reproduce', finding.stepsToReproduce ?? ''],
      ['Impact', finding.impact ?? ''],
      ['Remediation', finding.remediation ?? ''],
      [
        'References',
        (finding.references ?? '')
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => (/^[-*]\s/.test(line) ? line : `- ${line}`))
          .join('\n')
      ]
    ] as Array<[string, string]>
  ).filter(([, body]) => body.trim());
}

const cell = (value: string) => value.replace(/\|/g, '\\|').replace(/\n/g, '<br>');

export function renderEngagementMarkdown(report: EngagementReport): string {
  const { settings, findings } = report;
  const lines: string[] = [
    `# ${settings.title}`,
    '',
    [
      `**Prepared for:** ${settings.preparedFor}`,
      settings.preparedBy ? `**Prepared by:** ${settings.preparedBy}` : '',
      formatPeriod(report.period) ? `**Testing period:** ${formatPeriod(report.period)}` : '',
      `**Date:** ${formatReportDate(isoDay(report.generatedAt))}`,
      settings.classification ? `**Classification:** ${settings.classification}` : ''
    ]
      .filter(Boolean)
      .join('  \n'),
    '',
    '## Executive Summary',
    '',
    report.executiveSummary,
    '',
    `| ${SEVERITY_ORDER.map((severity) => SEVERITY_NAMES[severity]).join(' | ')} |`,
    `| ${SEVERITY_ORDER.map(() => '---').join(' | ')} |`,
    `| ${SEVERITY_ORDER.map((severity) => report.counts[severity]).join(' | ')} |`,
    ''
  ];
  if (report.scope.include.length || report.scope.exclude.length) {
    lines.push('## Scope', '');
    if (report.scope.include.length) lines.push('**In scope**', '', ...report.scope.include.map((rule) => `- \`${rule}\``), '');
    if (report.scope.exclude.length) lines.push('**Out of scope**', '', ...report.scope.exclude.map((rule) => `- \`${rule}\``), '');
  }
  if (findings.length) {
    lines.push('## Findings Overview', '', '| Ref | Finding | Severity | CVSS | Status |', '| --- | --- | --- | --- | --- |');
    for (const item of findings) {
      const score = item.finding.cvssScore ?? item.finding.cvss4Score;
      lines.push(`| ${item.ref} | ${cell(item.finding.title)} | ${SEVERITY_NAMES[item.finding.severity]} | ${score != null ? score.toFixed(1) : '—'} | ${item.status} |`);
    }
    lines.push('', '## Detailed Findings', '');
    for (const item of findings) {
      lines.push(`### ${item.ref}: ${item.finding.title}`, '', '| | |', '| --- | --- |');
      for (const [key, value] of findingFacts(item)) lines.push(`| **${key}** | ${cell(value)} |`);
      lines.push('');
      for (const [heading, body] of findingSections(item.finding)) lines.push(`#### ${heading}`, '', body.trim(), '');
      const textEvidence = item.evidence.filter((asset) => asset.httpExchange?.requestRaw || asset.textContent);
      if (textEvidence.length) {
        lines.push('#### Evidence', '');
        for (const asset of textEvidence) {
          const raw = asset.httpExchange
            ? [asset.httpExchange.requestRaw, asset.httpExchange.responseRaw].filter(Boolean).join('\n\n')
            : asset.textContent ?? '';
          lines.push(`**${asset.title}**`, '', '```' + (asset.httpExchange ? 'http' : ''), truncateLines(raw, 60), '```', '');
        }
      }
    }
  }
  if (report.testedAssets.length) {
    lines.push('## Appendix: Tested Assets', '', ...report.testedAssets.map((asset) => `- ${asset.url ?? asset.hostname}`), '');
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export function truncateLines(text: string, max: number): string {
  const all = text.replace(/\r\n/g, '\n').trimEnd().split('\n');
  if (all.length <= max) return all.join('\n');
  return [...all.slice(0, max), `… ${all.length - max} more lines`].join('\n');
}
