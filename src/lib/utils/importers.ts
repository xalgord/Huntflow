/**
 * Import parsers for the tools hunters already use.
 *
 * Everything here is pure (text in → structured records out) so it can be
 * unit-tested and reused by the import sheet, the CLI ingest endpoint and
 * drag-and-drop. Writing to the stores happens in `applyImport`.
 *
 * Supported:
 * - HackerOne structured-scope CSV ("Download CSV" on a program's scope)
 * - Pasted scope text (Bugcrowd/Intigriti/YesWeHack pages, "In scope" /
 *   "Out of scope" sections, tab-separated tables)
 * - Host lists: subfinder / amass / assetfinder (plain or `-oJ` JSON lines)
 * - httpx: `-json` lines or the default `url [status] [title] [tech]` output
 * - nuclei: `-jsonl` results → draft findings with evidence
 * - nmap: `-oX` XML → hosts with open ports and services
 * - Burp Suite: "Report selected issues" XML → draft findings
 */
import type { PayoutSeverity, ReconAssetSource, ScopeStatus, TargetAssetType } from '$lib/types';
import { evaluateScope, parseScopeRules, type ScopeRule } from './scopeValidator';

export type ImportKind = 'h1-scope-csv' | 'scope-text' | 'hosts' | 'httpx' | 'nuclei' | 'nmap' | 'burp';

export const IMPORT_KIND_LABELS: Record<ImportKind, string> = {
  'h1-scope-csv': 'HackerOne scope CSV',
  'scope-text': 'Scope text',
  hosts: 'Host list',
  httpx: 'httpx',
  nuclei: 'nuclei',
  nmap: 'nmap XML',
  burp: 'Burp issues XML'
};

export interface ImportedAsset {
  hostname: string;
  url?: string;
  ipAddress?: string;
  title?: string;
  httpStatus?: number;
  technologies: string[];
  ports: number[];
  assetType?: TargetAssetType;
  /** Set by scope sources; tool sources get a verdict from the program's rules. */
  scopeStatus?: ScopeStatus;
  source: ReconAssetSource;
  notes?: string;
}

export interface ImportedFinding {
  /** Stable key so re-importing the same scan doesn't duplicate findings. */
  sourceKey: string;
  source: 'nuclei' | 'burp';
  title: string;
  severity: PayoutSeverity;
  vulnerabilityType?: string;
  cweId?: string;
  cvssVector?: string;
  cvssScore?: number;
  summary?: string;
  remediation?: string;
  references?: string;
  affectedAssets: string[];
  /** Raw request (and optional response) for an http-exchange evidence asset. */
  httpEvidence?: string;
}

export interface ImportResult {
  kind: ImportKind;
  assets: ImportedAsset[];
  findings: ImportedFinding[];
  scope: { include: string[]; exclude: string[] };
  warnings: string[];
}

const empty = (kind: ImportKind): ImportResult => ({ kind, assets: [], findings: [], scope: { include: [], exclude: [] }, warnings: [] });

// ─── helpers ──────────────────────────────────────────────────────────────

const HOST_RE = /^(?:\*\.)?(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}$/i;
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export function hostFromValue(value: string): string | null {
  const trimmed = value.trim().replace(/^[[(<"']|[\])>"',;]$/g, '');
  if (!trimmed) return null;
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return new URL(trimmed).hostname.toLowerCase();
  } catch {
    return null;
  }
  const host = trimmed.split(/[/:?#\s]/)[0].toLowerCase();
  if (HOST_RE.test(host) || IPV4_RE.test(host)) return host.replace(/^\*\./, '');
  return null;
}

function lines(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function tryJson(line: string): Record<string, unknown> | null {
  if (!line.startsWith('{')) return null;
  try {
    const value = JSON.parse(line);
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : value == null ? [] : [value]);

function severityFrom(value: unknown): PayoutSeverity {
  const text = String(value ?? '').toLowerCase();
  if (text.startsWith('crit')) return 'critical';
  if (text.startsWith('high')) return 'high';
  if (text.startsWith('med')) return 'medium';
  if (text.startsWith('low')) return 'low';
  return 'informational';
}

function stripHtml(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const text = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|div|h\d)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text || undefined;
}

/** RFC 4180-ish CSV parser (quotes, escaped quotes, embedded newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const input = text.replace(/\r\n/g, '\n');
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

function dedupeAssets(assets: ImportedAsset[]): ImportedAsset[] {
  const byKey = new Map<string, ImportedAsset>();
  for (const asset of assets) {
    const key = `${asset.hostname}|${asset.url ?? ''}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...asset, technologies: [...new Set(asset.technologies)], ports: [...new Set(asset.ports)] });
      continue;
    }
    byKey.set(key, {
      ...existing,
      ...Object.fromEntries(Object.entries(asset).filter(([, value]) => value !== undefined)),
      technologies: [...new Set([...existing.technologies, ...asset.technologies])],
      ports: [...new Set([...existing.ports, ...asset.ports])].sort((a, b) => a - b)
    } as ImportedAsset);
  }
  return [...byKey.values()];
}

// ─── detection ────────────────────────────────────────────────────────────

export function detectImportKind(text: string, fileName = ''): ImportKind {
  const head = text.trimStart().slice(0, 4000);
  const lowerName = fileName.toLowerCase();
  if (/<nmaprun[\s>]/.test(head)) return 'nmap';
  if (/<issues[\s>]/.test(head) && /<issue[\s>]/.test(text.slice(0, 20000))) return 'burp';
  const firstLine = head.split('\n')[0].toLowerCase();
  if (firstLine.includes('identifier') && firstLine.includes('asset_type')) return 'h1-scope-csv';
  const firstJson = tryJson(head.split('\n')[0].trim());
  if (firstJson) {
    if ('template-id' in firstJson || 'templateID' in firstJson || ('info' in firstJson && 'matched-at' in firstJson)) return 'nuclei';
    if ('status_code' in firstJson || 'status-code' in firstJson || 'webserver' in firstJson || 'tech' in firstJson) return 'httpx';
    if ('host' in firstJson) return 'hosts';
  }
  if (lowerName.endsWith('.csv') && firstLine.includes('identifier')) return 'h1-scope-csv';
  if (/\bout[\s-]?of[\s-]?scope\b|\bin[\s-]?scope\b/i.test(head)) return 'scope-text';
  const sample = lines(head).slice(0, 20);
  if (sample.some((line) => /^https?:\/\/\S+\s+\[\d{3}\]/.test(line))) return 'httpx';
  return 'hosts';
}

// ─── parsers ──────────────────────────────────────────────────────────────

const H1_TYPE_MAP: Record<string, TargetAssetType> = {
  URL: 'web',
  WILDCARD: 'web',
  API: 'api',
  CIDR: 'other',
  IP_ADDRESS: 'other',
  GOOGLE_PLAY_APP_ID: 'mobile',
  APPLE_STORE_APP_ID: 'mobile',
  TESTFLIGHT: 'mobile',
  OTHER_APK: 'mobile',
  OTHER_IPA: 'mobile',
  WINDOWS_APP_STORE_APP_ID: 'other',
  DOWNLOADABLE_EXECUTABLES: 'other',
  HARDWARE: 'other',
  SMART_CONTRACT: 'other',
  SOURCE_CODE: 'source-code',
  AWS_CLOUD_CONFIG: 'cloud',
  AI_MODEL: 'other',
  OTHER: 'other'
};

function parseH1ScopeCsv(text: string): ImportResult {
  const result = empty('h1-scope-csv');
  const [header, ...rows] = parseCsv(text);
  if (!header) return result;
  const col = (name: string) => header.findIndex((cell) => cell.trim().toLowerCase() === name);
  const identifier = col('identifier');
  const type = col('asset_type');
  const submission = col('eligible_for_submission');
  const bounty = col('eligible_for_bounty');
  const instruction = col('instruction');
  const maxSeverity = col('max_severity');
  if (identifier < 0) {
    result.warnings.push('No "identifier" column found.');
    return result;
  }
  for (const row of rows) {
    const id = row[identifier]?.trim();
    if (!id) continue;
    const assetType = (row[type] ?? 'OTHER').trim().toUpperCase();
    const inScope = String(row[submission] ?? 'true').trim().toLowerCase() !== 'false';
    const ruleable = ['URL', 'WILDCARD', 'CIDR', 'IP_ADDRESS', 'API'].includes(assetType);
    if (ruleable) (inScope ? result.scope.include : result.scope.exclude).push(id);

    const notes = [
      bounty >= 0 && String(row[bounty]).trim().toLowerCase() === 'false' ? 'Not eligible for bounty.' : '',
      maxSeverity >= 0 && row[maxSeverity]?.trim() ? `Max severity: ${row[maxSeverity].trim()}.` : '',
      instruction >= 0 ? (row[instruction] ?? '').trim() : ''
    ]
      .filter(Boolean)
      .join(' ');

    // Wildcards are rules, not testable assets; everything else becomes a target.
    if (assetType === 'WILDCARD' || id.includes('*')) continue;
    const host = ruleable && assetType !== 'CIDR' ? hostFromValue(id) : null;
    result.assets.push({
      hostname: host ?? id,
      url: /^https?:\/\//i.test(id) ? id : undefined,
      technologies: [],
      ports: [],
      assetType: H1_TYPE_MAP[assetType] ?? 'other',
      scopeStatus: inScope ? 'in-scope' : 'out-of-scope',
      source: 'import',
      notes: notes || undefined
    });
  }
  result.assets = dedupeAssets(result.assets);
  return result;
}

function parseScopeText(text: string): ImportResult {
  const result = empty('scope-text');
  let section: 'include' | 'exclude' = 'include';
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/\bout[\s-]?of[\s-]?scope\b|\bexclusions?\b|\bnot in scope\b/i.test(line) && line.length < 80 && !hostFromValue(line.split(/\s+/)[0])) {
      section = 'exclude';
      continue;
    }
    if (/\bin[\s-]?scope\b/i.test(line) && line.length < 80 && !hostFromValue(line.split(/\s+/)[0])) {
      section = 'include';
      continue;
    }
    // Tables copied from program pages: first cell is the target.
    const cell = line.split(/\t| {2,}|\s\|\s|^\|/).map((part) => part.trim()).find(Boolean) ?? '';
    const token = cell.replace(/^(?:[-•+]|\*(?!\.))\s*/, '');
    const looksLikeTarget = /^\*\.|^https?:\/\/|^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d+)?$/.test(token) || Boolean(hostFromValue(token));
    if (!looksLikeTarget || /\s/.test(token)) continue;
    (section === 'include' ? result.scope.include : result.scope.exclude).push(token);
    if (!token.startsWith('*') && !token.includes('/') ) {
      const host = hostFromValue(token);
      if (host) result.assets.push({ hostname: host, technologies: [], ports: [], scopeStatus: section === 'include' ? 'in-scope' : 'out-of-scope', source: 'import', assetType: 'web' });
    } else if (/^https?:\/\//i.test(token)) {
      const host = hostFromValue(token);
      if (host) result.assets.push({ hostname: host, url: token, technologies: [], ports: [], scopeStatus: section === 'include' ? 'in-scope' : 'out-of-scope', source: 'import', assetType: 'web' });
    }
  }
  result.scope.include = [...new Set(result.scope.include)];
  result.scope.exclude = [...new Set(result.scope.exclude)];
  result.assets = dedupeAssets(result.assets);
  if (!result.scope.include.length && !result.scope.exclude.length) result.warnings.push('No domains, URLs or IP ranges found.');
  return result;
}

function parseHosts(text: string): ImportResult {
  const result = empty('hosts');
  for (const line of lines(text)) {
    const json = tryJson(line);
    const value = json ? str(json.host) ?? str(json.name) ?? str(json.input) : line.split(/[\s,]/)[0];
    const source: ReconAssetSource = json && str(json.source) ? (String(json.source).includes('amass') ? 'amass' : 'subfinder') : 'subfinder';
    if (!value) continue;
    const host = hostFromValue(value);
    if (!host) continue;
    result.assets.push({ hostname: host, technologies: [], ports: [], source, assetType: 'web' });
  }
  result.assets = dedupeAssets(result.assets);
  if (!result.assets.length) result.warnings.push('No hostnames found.');
  return result;
}

function parseHttpx(text: string): ImportResult {
  const result = empty('httpx');
  for (const line of lines(text)) {
    const json = tryJson(line);
    if (json) {
      const url = str(json.url) ?? str(json.input);
      const host = url ? hostFromValue(url) : null;
      if (!host) continue;
      const port = num(json.port) ?? (str(json.port) ? Number(json.port) : undefined);
      const ip = arr(json.a).map(String)[0] ?? (IPV4_RE.test(String(json.host ?? '')) ? String(json.host) : undefined);
      result.assets.push({
        hostname: host,
        url,
        ipAddress: ip,
        title: str(json.title),
        httpStatus: num(json.status_code) ?? num(json['status-code']),
        technologies: [...arr(json.tech).map(String), ...(str(json.webserver) ? [String(json.webserver)] : [])],
        ports: port && Number.isFinite(port) ? [port] : [],
        source: 'httpx',
        assetType: 'web'
      });
      continue;
    }
    const match = line.match(/^(https?:\/\/\S+)(.*)$/);
    if (!match) continue;
    const brackets = [...match[2].matchAll(/\[([^\]]*)\]/g)].map((group) => group[1].trim());
    const status = brackets.find((value) => /^\d{3}$/.test(value));
    const rest = brackets.filter((value) => value !== status);
    const host = hostFromValue(match[1]);
    if (!host) continue;
    result.assets.push({
      hostname: host,
      url: match[1],
      httpStatus: status ? Number(status) : undefined,
      title: rest.length > 1 ? rest[0] : undefined,
      technologies: (rest.length > 1 ? rest.slice(1) : rest).flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean),
      ports: [],
      source: 'httpx',
      assetType: 'web'
    });
  }
  result.assets = dedupeAssets(result.assets);
  if (!result.assets.length) result.warnings.push('No httpx results found.');
  return result;
}

function parseNuclei(text: string): ImportResult {
  const result = empty('nuclei');
  const seen = new Set<string>();
  for (const line of lines(text)) {
    const json = tryJson(line);
    if (!json) continue;
    const info = (json.info ?? {}) as Record<string, unknown>;
    const classification = (info.classification ?? {}) as Record<string, unknown>;
    const templateId = str(json['template-id']) ?? str(json.templateID) ?? 'unknown-template';
    const matchedAt = str(json['matched-at']) ?? str(json.matched) ?? str(json.host) ?? '';
    const host = hostFromValue(matchedAt) ?? hostFromValue(String(json.host ?? ''));
    const severity = severityFrom(info.severity);
    // Info-level hits (tech-detect, waf-detect, panels) describe the target,
    // they aren't vulnerabilities: record them as technologies instead.
    const detected = severity === 'informational' ? str(json['matcher-name']) ?? str(info.name) : undefined;
    if (host) {
      let origin: string | undefined;
      try {
        origin = /^https?:\/\//.test(matchedAt) ? new URL(matchedAt).origin : undefined;
      } catch {
        origin = undefined;
      }
      result.assets.push({
        hostname: host,
        url: origin,
        ipAddress: str(json.ip),
        technologies: detected ? [detected] : [],
        ports: [],
        source: 'nuclei',
        assetType: 'web'
      });
    }
    if (severity === 'informational') continue;
    const key = `nuclei:${templateId}:${matchedAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cwe = arr(classification['cwe-id']).map((value) => String(value).toUpperCase())[0];
    const references = arr(info.reference).map(String).filter(Boolean);
    const extracted = arr(json['extracted-results']).map(String).filter(Boolean);
    const description = str(info.description);
    const request = str(json.request) ?? str(json['curl-command']);
    const response = str(json.response);
    result.findings.push({
      sourceKey: key,
      source: 'nuclei',
      title: `${str(info.name) ?? templateId}${host ? ` on ${host}` : ''}`,
      severity,
      vulnerabilityType: str(info.name),
      cweId: cwe && /^CWE-\d+$/.test(cwe) ? cwe : undefined,
      cvssVector: str(classification['cvss-metrics']),
      cvssScore: num(classification['cvss-score']),
      summary: [
        description,
        `Detected by the nuclei template \`${templateId}\` at \`${matchedAt}\`${str(json['matcher-name']) ? ` (matcher: ${json['matcher-name']})` : ''}. Verify manually before reporting.`,
        extracted.length ? `Extracted: ${extracted.map((value) => `\`${value}\``).join(', ')}` : ''
      ]
        .filter(Boolean)
        .join('\n\n'),
      remediation: str(info.remediation),
      references: references.join('\n') || undefined,
      affectedAssets: matchedAt ? [matchedAt] : [],
      httpEvidence: request ? [request, response].filter(Boolean).join('\n\n') : undefined
    });
  }
  result.assets = dedupeAssets(result.assets);
  if (!result.findings.length && !result.assets.length) result.warnings.push('No nuclei results found.');
  return result;
}

function xmlDocument(text: string): Document | null {
  if (typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  return doc.querySelector('parsererror') ? null : doc;
}

function parseNmap(text: string): ImportResult {
  const result = empty('nmap');
  const doc = xmlDocument(text);
  if (!doc) {
    result.warnings.push('Could not read the nmap XML.');
    return result;
  }
  for (const hostEl of Array.from(doc.querySelectorAll('host'))) {
    if (hostEl.querySelector('status')?.getAttribute('state') === 'down') continue;
    const ip = hostEl.querySelector('address[addrtype="ipv4"], address[addrtype="ipv6"]')?.getAttribute('addr') ?? undefined;
    const names = Array.from(hostEl.querySelectorAll('hostnames hostname'))
      .map((el) => el.getAttribute('name'))
      .filter((name): name is string => Boolean(name));
    const ports: number[] = [];
    const services: string[] = [];
    for (const portEl of Array.from(hostEl.querySelectorAll('ports port'))) {
      if (portEl.querySelector('state')?.getAttribute('state') !== 'open') continue;
      ports.push(Number(portEl.getAttribute('portid')));
      const service = portEl.querySelector('service');
      const label = [service?.getAttribute('product'), service?.getAttribute('version')].filter(Boolean).join(' ') || service?.getAttribute('name');
      if (label) services.push(label);
    }
    const hostname = (names[0] ?? ip ?? '').toLowerCase();
    if (!hostname) continue;
    result.assets.push({
      hostname,
      ipAddress: ip,
      technologies: services,
      ports: ports.sort((a, b) => a - b),
      source: 'nmap',
      assetType: 'other',
      notes: names.length > 1 ? `Also known as ${names.slice(1).join(', ')}` : undefined
    });
  }
  result.assets = dedupeAssets(result.assets);
  if (!result.assets.length) result.warnings.push('No live hosts found in the nmap XML.');
  return result;
}

function decodeMaybeBase64(el: Element | null): string | undefined {
  if (!el?.textContent) return undefined;
  const value = el.textContent;
  if (el.getAttribute('base64') !== 'true') return value;
  try {
    const binary = atob(value.replace(/\s+/g, ''));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return undefined;
  }
}

function parseBurp(text: string): ImportResult {
  const result = empty('burp');
  const doc = xmlDocument(text);
  if (!doc) {
    result.warnings.push('Could not read the Burp issues XML.');
    return result;
  }
  for (const issue of Array.from(doc.querySelectorAll('issue'))) {
    const pick = (selector: string) => issue.querySelector(selector)?.textContent?.trim() || undefined;
    const name = pick('name') ?? 'Burp issue';
    const hostUrl = pick('host') ?? '';
    const path = pick('path') ?? '';
    const location = hostUrl + path;
    const host = hostFromValue(hostUrl);
    if (host) result.assets.push({ hostname: host, url: /^https?:\/\//.test(hostUrl) ? hostUrl : undefined, ipAddress: issue.querySelector('host')?.getAttribute('ip') ?? undefined, technologies: [], ports: [], source: 'burp', assetType: 'web' });
    const request = decodeMaybeBase64(issue.querySelector('requestresponse request'));
    const response = decodeMaybeBase64(issue.querySelector('requestresponse response'));
    const references = [...(pick('references') ?? '').matchAll(/href=["']([^"']+)["']/g)].map((match) => match[1]);
    const cwe = (pick('vulnerabilityClassifications') ?? '').match(/CWE-\d+/)?.[0];
    result.findings.push({
      sourceKey: `burp:${pick('type') ?? name}:${location}`,
      source: 'burp',
      title: `${name}${host ? ` on ${host}` : ''}`,
      severity: severityFrom(pick('severity')),
      vulnerabilityType: name,
      cweId: cwe,
      summary: [stripHtml(pick('issueDetail')), stripHtml(pick('issueBackground')), `Reported by Burp Suite (confidence: ${pick('confidence') ?? 'unknown'}). Verify manually before reporting.`]
        .filter(Boolean)
        .join('\n\n'),
      remediation: [stripHtml(pick('remediationDetail')), stripHtml(pick('remediationBackground'))].filter(Boolean).join('\n\n') || undefined,
      references: references.join('\n') || undefined,
      affectedAssets: location ? [location] : [],
      httpEvidence: request ? [request.trimEnd(), response?.trimEnd()].filter(Boolean).join('\n\n') : undefined
    });
  }
  result.assets = dedupeAssets(result.assets);
  if (!result.findings.length) result.warnings.push('No issues found in the Burp XML.');
  return result;
}

export function parseImport(text: string, kind: ImportKind = detectImportKind(text)): ImportResult {
  switch (kind) {
    case 'h1-scope-csv':
      return parseH1ScopeCsv(text);
    case 'scope-text':
      return parseScopeText(text);
    case 'httpx':
      return parseHttpx(text);
    case 'nuclei':
      return parseNuclei(text);
    case 'nmap':
      return parseNmap(text);
    case 'burp':
      return parseBurp(text);
    default:
      return parseHosts(text);
  }
}

/**
 * Give every tool-discovered asset a scope verdict from the program's rules
 * (plus any rules arriving in the same import), so out-of-scope hosts are
 * flagged before anyone tests them.
 */
export function classifyScope(result: ImportResult, programScope: string): ImportResult {
  const rules: ScopeRule[] = parseScopeRules(
    [programScope, ...result.scope.include, ...result.scope.exclude.map((rule) => `- ${rule}`)].join('\n')
  );
  if (rules.length === 0) return result;
  return {
    ...result,
    assets: result.assets.map((asset) => {
      if (asset.scopeStatus) return asset;
      const verdict = evaluateScope(asset.url ?? `https://${asset.hostname}`, rules).verdict;
      return { ...asset, scopeStatus: verdict === 'in-scope' ? 'in-scope' : verdict === 'out-of-scope' ? 'out-of-scope' : 'unknown' };
    })
  };
}

/** Append new scope rules to a program's scope text without duplicating any. */
export function mergeScopeText(existing: string, include: string[], exclude: string[], label: string): string {
  const current = new Set(
    existing
      .split('\n')
      .map((line) => line.trim().replace(/^[+]\s*|^in:\s*/i, ''))
      .filter(Boolean)
  );
  const additions = [
    ...include.filter((rule) => !current.has(rule)),
    ...exclude.map((rule) => `- ${rule}`).filter((rule) => !current.has(rule))
  ];
  if (additions.length === 0) return existing;
  return [existing.trimEnd(), existing.trim() ? '' : null, `# ${label}`, ...additions].filter((line) => line !== null).join('\n').trim();
}
