import type { Note } from '$lib/types';

export type ReportPlatform = 'hackerone' | 'bugcrowd' | 'intigriti' | 'custom';
export type ReportSeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational';
export type ReportSectionSource = 'auto' | 'manual';

export interface ReportSection {
  id: string;
  title: string;
  source: ReportSectionSource;
  mapping?: ReportFieldKey;
  defaultContent?: string;
  required: boolean;
}

export interface ReportTemplate {
  id: string;
  name: string;
  platform: ReportPlatform;
  sections: ReportSection[];
}

export interface ReportFields {
  title: string;
  severity: ReportSeverity;
  summary: string;
  reproductionSteps: string;
  impact: string;
  proofOfConcept: string;
  remediation: string;
  affectedAsset: string;
  vulnerabilityType: string;
  references: string;
  rawNotes: string;
  cvssVector?: string;
  cvssScore?: number;
}

export type ReportFieldKey =
  | 'title'
  | 'severity'
  | 'summary'
  | 'reproductionSteps'
  | 'impact'
  | 'proofOfConcept'
  | 'remediation'
  | 'affectedAsset'
  | 'vulnerabilityType'
  | 'references'
  | 'rawNotes';

export interface ReportDraft {
  platform: ReportPlatform;
  templateId: string;
  noteId?: string;
  fields: ReportFields;
  markdown: string;
  missingRequiredSections: string[];
  updatedAt: number;
}

const fieldAliases: Record<ReportFieldKey, string[]> = {
  title: ['title', 'report title'],
  severity: ['severity', 'risk', 'risk rating', 'priority'],
  summary: ['summary', 'description', 'overview', 'vulnerability details', 'details', 'finding'],
  reproductionSteps: [
    'steps to reproduce',
    'reproduction steps',
    'steps',
    'reproduce',
    'reproduction',
    'how to reproduce'
  ],
  impact: ['impact', 'business impact', 'security impact', 'risk impact'],
  proofOfConcept: [
    'proof of concept',
    'poc',
    'evidence',
    'proof',
    'exploit',
    'request',
    'response',
    'request response',
    'proof of takeover'
  ],
  remediation: ['remediation', 'recommendation', 'recommendations', 'mitigation', 'fix', 'resolution'],
  affectedAsset: [
    'affected asset',
    'affected assets',
    'affected endpoint',
    'vulnerable endpoint',
    'vulnerable subdomain',
    'target',
    'url',
    'endpoint',
    'scope'
  ],
  vulnerabilityType: ['vulnerability type', 'type', 'category', 'weakness', 'cwe'],
  references: ['references', 'reference', 'links', 'resources'],
  rawNotes: ['notes', 'raw notes']
};

const severityAliases: Record<ReportSeverity, string[]> = {
  critical: ['critical', 'crit', 'p0', 'sev0', 'severity-critical'],
  high: ['high', 'p1', 'sev1', 'severity-high'],
  medium: ['medium', 'med', 'p2', 'sev2', 'severity-medium'],
  low: ['low', 'p3', 'sev3', 'severity-low'],
  informational: ['informational', 'informative', 'info', 'p4', 'sev4', 'severity-info']
};

const severityRank: Record<ReportSeverity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  informational: 1
};

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'hackerone-standard',
    name: 'HackerOne Standard',
    platform: 'hackerone',
    sections: [
      { id: 'title', title: 'Title', source: 'manual', mapping: 'title', required: true },
      { id: 'severity', title: 'Severity', source: 'auto', mapping: 'severity', required: true },
      { id: 'summary', title: 'Summary', source: 'auto', mapping: 'summary', required: true },
      {
        id: 'steps',
        title: 'Steps to Reproduce',
        source: 'auto',
        mapping: 'reproductionSteps',
        required: true
      },
      { id: 'impact', title: 'Impact', source: 'auto', mapping: 'impact', required: true },
      {
        id: 'poc',
        title: 'Proof of Concept',
        source: 'auto',
        mapping: 'proofOfConcept',
        required: false
      },
      { id: 'remediation', title: 'Remediation', source: 'auto', mapping: 'remediation', required: false }
    ]
  },
  {
    id: 'bugcrowd-standard',
    name: 'Bugcrowd Standard',
    platform: 'bugcrowd',
    sections: [
      { id: 'title', title: 'Title', source: 'manual', mapping: 'title', required: true },
      { id: 'severity', title: 'Severity', source: 'auto', mapping: 'severity', required: true },
      { id: 'summary', title: 'Vulnerability Details', source: 'auto', mapping: 'summary', required: true },
      { id: 'asset', title: 'Affected Asset', source: 'auto', mapping: 'affectedAsset', required: false },
      {
        id: 'steps',
        title: 'Steps to Reproduce',
        source: 'auto',
        mapping: 'reproductionSteps',
        required: true
      },
      { id: 'poc', title: 'Proof of Concept', source: 'auto', mapping: 'proofOfConcept', required: false },
      { id: 'impact', title: 'Impact', source: 'auto', mapping: 'impact', required: true },
      { id: 'remediation', title: 'Suggested Remediation', source: 'auto', mapping: 'remediation', required: false }
    ]
  },
  {
    id: 'intigriti-standard',
    name: 'Intigriti Standard',
    platform: 'intigriti',
    sections: [
      { id: 'title', title: 'Title', source: 'manual', mapping: 'title', required: true },
      { id: 'severity', title: 'Severity', source: 'auto', mapping: 'severity', required: true },
      { id: 'summary', title: 'Summary', source: 'auto', mapping: 'summary', required: true },
      { id: 'asset', title: 'Endpoint or Asset', source: 'auto', mapping: 'affectedAsset', required: false },
      {
        id: 'details',
        title: 'Technical Details',
        source: 'auto',
        mapping: 'reproductionSteps',
        required: true
      },
      { id: 'poc', title: 'Evidence', source: 'auto', mapping: 'proofOfConcept', required: false },
      { id: 'impact', title: 'Impact', source: 'auto', mapping: 'impact', required: true },
      { id: 'remediation', title: 'Recommendations', source: 'auto', mapping: 'remediation', required: false }
    ]
  },
  {
    id: 'custom-standard',
    name: 'Custom Markdown',
    platform: 'custom',
    sections: [
      { id: 'title', title: 'Title', source: 'manual', mapping: 'title', required: true },
      { id: 'severity', title: 'Severity', source: 'auto', mapping: 'severity', required: true },
      { id: 'asset', title: 'Affected Asset', source: 'auto', mapping: 'affectedAsset', required: false },
      { id: 'type', title: 'Vulnerability Type', source: 'auto', mapping: 'vulnerabilityType', required: false },
      { id: 'summary', title: 'Summary', source: 'auto', mapping: 'summary', required: true },
      {
        id: 'steps',
        title: 'Steps to Reproduce',
        source: 'auto',
        mapping: 'reproductionSteps',
        required: true
      },
      { id: 'impact', title: 'Impact', source: 'auto', mapping: 'impact', required: true },
      {
        id: 'poc',
        title: 'Proof of Concept',
        source: 'auto',
        mapping: 'proofOfConcept',
        required: false
      },
      { id: 'remediation', title: 'Remediation', source: 'auto', mapping: 'remediation', required: false },
      { id: 'references', title: 'References', source: 'auto', mapping: 'references', required: false }
    ]
  }
];

const aliasLookup = new Map<string, ReportFieldKey>();

for (const [field, aliases] of Object.entries(fieldAliases) as [ReportFieldKey, string[]][]) {
  for (const alias of aliases) {
    aliasLookup.set(normalizeLabel(alias), field);
  }
}

export function getReportTemplate(platform: ReportPlatform): ReportTemplate {
  return REPORT_TEMPLATES.find((template) => template.platform === platform) ?? REPORT_TEMPLATES[0];
}

export function createEmptyReportFields(): ReportFields {
  return {
    title: '',
    severity: 'medium',
    summary: '',
    reproductionSteps: '',
    impact: '',
    proofOfConcept: '',
    remediation: '',
    affectedAsset: '',
    vulnerabilityType: '',
    references: '',
    rawNotes: '',
    cvssVector: '',
    cvssScore: undefined
  };
}

export function suggestSeverityFromTags(tags: string[]): ReportSeverity | null {
  const matches = tags
    .map((tag) => severityFromText(tag))
    .filter((severity): severity is ReportSeverity => Boolean(severity));

  if (matches.length === 0) return null;

  return matches.sort((a, b) => severityRank[b] - severityRank[a])[0];
}

export function inferSeverityFromNote(note: Pick<Note, 'content' | 'tags'>): ReportSeverity {
  const tagSeverity = suggestSeverityFromTags(note.tags);
  if (tagSeverity) return tagSeverity;

  const parsedSeverity = parseNoteFields({ title: '', content: note.content, tags: note.tags }).severity;
  return parsedSeverity || 'medium';
}

export function parseNoteFields(note: Pick<Note, 'title' | 'content' | 'tags'>): ReportFields {
  const fields = createEmptyReportFields();
  const buckets = createEmptyBuckets();
  let activeField: ReportFieldKey | null = null;

  for (const line of note.content.split('\n')) {
    const heading = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line.trim());

    if (heading) {
      activeField = resolveFieldFromHeading(heading[2]);
      continue;
    }

    if (activeField) {
      buckets[activeField].push(line);
    }
  }

  for (const field of Object.keys(buckets) as ReportFieldKey[]) {
    setParsedField(fields, field, cleanMarkdownSection(buckets[field].join('\n')));
  }

  const firstHeading = /^#\s+(.+)$/m.exec(note.content);
  const tagSeverity = suggestSeverityFromTags(note.tags);
  const contentSeverity = severityFromText(fields.severity);

  fields.title = cleanInlineMarkdown(fields.title || note.title || firstHeading?.[1] || '');
  fields.severity = tagSeverity ?? contentSeverity ?? 'medium';
  fields.summary = fields.summary || extractFirstParagraph(note.content);
  fields.rawNotes = note.content.trim();

  return fields;
}

function setParsedField(fields: ReportFields, field: ReportFieldKey, value: string): void {
  if (field === 'severity') {
    fields.severity = severityFromText(value) ?? fields.severity;
    return;
  }

  fields[field] = value;
}

export function buildReportDraftFromNote(
  note: Note,
  template: ReportTemplate = getReportTemplate('hackerone')
): ReportDraft {
  const fields = parseNoteFields(note);
  const markdown = renderReportMarkdown(template, fields);

  return {
    platform: template.platform,
    templateId: template.id,
    noteId: note.id,
    fields,
    markdown,
    missingRequiredSections: getMissingRequiredSections(template, fields),
    updatedAt: Date.now()
  };
}

export function renderReportMarkdown(template: ReportTemplate, fields: ReportFields): string {
  const lines: string[] = [];

  for (const section of template.sections) {
    const value = getSectionValue(section, fields).trim();

    if (!value && !section.required) continue;

    if (section.id === 'title') {
      lines.push(`# ${value || 'Untitled Report'}`);
      lines.push('');
      const cvssLine = formatCvssMetadata(fields);
      if (cvssLine) {
        lines.push(cvssLine);
        lines.push('');
      }
      continue;
    }

    lines.push(`## ${section.title}`);
    lines.push('');
    lines.push(formatSectionValue(section, value));
    lines.push('');
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

export function getMissingRequiredSections(template: ReportTemplate, fields: ReportFields): string[] {
  return template.sections
    .filter((section) => section.required)
    .filter((section) => !getSectionValue(section, fields).trim())
    .map((section) => section.title);
}

export function downloadMarkdownReport(markdown: string, title: string): void {
  if (typeof document === 'undefined') return;

  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);

  anchor.href = url;
  anchor.download = `${slugifyFilename(title || 'huntflow-report')}-${date}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function copyReportMarkdown(markdown: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(markdown);
    return true;
  }

  if (typeof document === 'undefined') return false;

  const textarea = document.createElement('textarea');
  textarea.value = markdown;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  return copied;
}

export function printReportAsPdf(markdown: string, title: string): boolean {
  if (typeof window === 'undefined') return false;

  const printWindow = window.open('', '_blank', 'width=960,height=720');
  if (!printWindow) return false;

  printWindow.document.open();
  printWindow.document.write(buildPrintableHtml(markdown, title));
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => printWindow.print(), 250);
  return true;
}

export function renderMarkdownToHtml(markdown: string): string {
  const html: string[] = [];
  const paragraph: string[] = [];
  const listItems: string[] = [];
  let orderedList = false;
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (const line of markdown.split('\n')) {
    if (line.trim().startsWith('```')) {
      flushParagraph(paragraph, html);
      flushList(listItems, html, orderedList);

      if (inCodeBlock) {
        html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph(paragraph, html);
      flushList(listItems, html, orderedList);
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph(paragraph, html);
      flushList(listItems, html, orderedList);
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    const quote = /^>\s?(.+)$/.exec(trimmed);
    if (quote) {
      flushParagraph(paragraph, html);
      flushList(listItems, html, orderedList);
      html.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
      continue;
    }

    const unordered = /^[-*]\s+(.+)$/.exec(trimmed);
    const ordered = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (unordered || ordered) {
      const nextOrdered = Boolean(ordered);
      if (listItems.length > 0 && nextOrdered !== orderedList) {
        flushList(listItems, html, orderedList);
      }
      orderedList = nextOrdered;
      listItems.push((ordered ?? unordered)?.[1] ?? '');
      continue;
    }

    flushList(listItems, html, orderedList);
    paragraph.push(trimmed);
  }

  flushParagraph(paragraph, html);
  flushList(listItems, html, orderedList);
  if (inCodeBlock) html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);

  return html.join('\n');
}

function getSectionValue(section: ReportSection, fields: ReportFields): string {
  const mapping = section.mapping ?? (section.id as ReportFieldKey);
  const value = fields[mapping] ?? '';
  return value || section.defaultContent || '';
}

function formatSectionValue(section: ReportSection, value: string): string {
  if (section.mapping === 'severity') return formatSeverity(value as ReportSeverity);
  return value;
}

function formatSeverity(severity: ReportSeverity): string {
  if (severity === 'informational') return 'Informational';
  return `${severity.charAt(0).toUpperCase()}${severity.slice(1)}`;
}

function formatCvssMetadata(fields: ReportFields): string {
  const parts: string[] = [];
  if (fields.severity) parts.push(`**Severity:** ${formatSeverity(fields.severity)}`);
  if (typeof fields.cvssScore === 'number' && Number.isFinite(fields.cvssScore)) {
    parts.push(`**CVSS:** ${fields.cvssScore.toFixed(1)}`);
  }
  if (fields.cvssVector && fields.cvssVector.trim()) {
    parts.push(`**Vector:** \`${fields.cvssVector.trim()}\``);
  }
  return parts.length > 0 ? parts.join(' · ') : '';
}

function resolveFieldFromHeading(heading: string): ReportFieldKey | null {
  return aliasLookup.get(normalizeLabel(heading)) ?? null;
}

function createEmptyBuckets(): Record<ReportFieldKey, string[]> {
  return {
    title: [],
    severity: [],
    summary: [],
    reproductionSteps: [],
    impact: [],
    proofOfConcept: [],
    remediation: [],
    affectedAsset: [],
    vulnerabilityType: [],
    references: [],
    rawNotes: []
  };
}

function cleanMarkdownSection(value: string): string {
  return value
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''))
    .join('\n')
    .trim();
}

function cleanInlineMarkdown(value: string): string {
  return value
    .replace(/^#+\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim();
}

function extractFirstParagraph(markdown: string): string {
  const lines = markdown.split('\n');
  const paragraph: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (paragraph.length > 0) break;
      continue;
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      if (paragraph.length > 0) break;
      continue;
    }

    if (/^\(.+\)$/.test(trimmed)) continue;
    paragraph.push(trimmed);
  }

  return paragraph.join(' ').trim();
}

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[`*_:[\](){}#]/g, '')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function severityFromText(value: string): ReportSeverity | null {
  const normalized = normalizeLabel(value);
  const tokens = new Set(normalized.split(' ').filter(Boolean));

  for (const [severity, aliases] of Object.entries(severityAliases) as [ReportSeverity, string[]][]) {
    if (aliases.some((alias) => normalized === normalizeLabel(alias) || tokens.has(normalizeLabel(alias)))) {
      return severity;
    }
  }

  return null;
}

function slugifyFilename(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'huntflow-report'
  );
}

function buildPrintableHtml(markdown: string, title: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title || 'HuntFlow Report')}</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        background: #ffffff;
        color: #0f172a;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.6;
      }
      main {
        max-width: 820px;
        margin: 0 auto;
        padding: 48px;
      }
      h1, h2, h3, h4 {
        line-height: 1.25;
        color: #0f172a;
      }
      h1 {
        margin: 0 0 28px;
        font-size: 30px;
      }
      h2 {
        margin: 28px 0 10px;
        padding-bottom: 6px;
        border-bottom: 1px solid #cbd5e1;
        font-size: 20px;
      }
      h3, h4 {
        margin: 20px 0 8px;
      }
      p {
        margin: 10px 0;
      }
      code {
        border-radius: 4px;
        background: #f1f5f9;
        padding: 2px 5px;
        font-family: "SFMono-Regular", Consolas, monospace;
        font-size: 0.9em;
      }
      pre {
        overflow-x: auto;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: #f8fafc;
        padding: 16px;
      }
      pre code {
        background: transparent;
        padding: 0;
      }
      blockquote {
        margin: 16px 0;
        border-left: 4px solid #94a3b8;
        padding-left: 16px;
        color: #475569;
      }
      a {
        color: #047857;
      }
      @page {
        margin: 18mm;
      }
      @media print {
        main {
          max-width: none;
          padding: 0;
        }
      }
    </style>
  </head>
  <body>
    <main>${renderMarkdownToHtml(markdown)}</main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderInline(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function flushParagraph(lines: string[], html: string[]): void {
  if (lines.length === 0) return;
  html.push(`<p>${renderInline(lines.join(' '))}</p>`);
  lines.length = 0;
}

function flushList(items: string[], html: string[], ordered: boolean): void {
  if (items.length === 0) return;
  const tag = ordered ? 'ol' : 'ul';
  html.push(`<${tag}>${items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</${tag}>`);
  items.length = 0;
}
