/**
 * Scope validation helpers — evaluate whether a URL is in-scope per a
 * target's scope rules (free-form text the user pastes in from HackerOne,
 * Bugcrowd, etc.).
 *
 * Supported per-line syntax:
 *   - Lines starting with "+" or "in:"  → include rule
 *   - Lines starting with "-", "!", or "out:" → exclude rule
 *   - Bare lines default to include
 *   - Blank lines and # comments are ignored
 *
 * Pattern types (per rule):
 *   - "*.example.com"     → wildcard subdomain (matches example.com and any sub)
 *   - "example.com"       → exact host or any subdomain
 *   - "https://example.com/admin/*" → URL prefix match
 *   - "/api/*"            → path prefix (any host)
 *   - "1.2.3.4"           → IPv4 exact host
 *   - "1.2.3.0/24"        → IPv4 CIDR
 *
 * The most specific matching rule wins (longer match length). Excludes beat
 * includes when both have equal specificity, mirroring how programs phrase
 * scope ("everything under foo.com EXCEPT admin.foo.com").
 */

export type ScopeVerdict = 'in-scope' | 'out-of-scope' | 'no-rules';

export interface ScopeRule {
  raw: string;
  kind: 'include' | 'exclude';
  pattern: ParsedPattern;
}

export interface ScopeMatch {
  verdict: ScopeVerdict;
  matchedRule?: ScopeRule;
  reason: string;
  /** Specificity used to break ties — exposed for debugging. */
  specificity: number;
}

interface ParsedPattern {
  type: 'host-wildcard' | 'host-exact' | 'host-suffix' | 'url-prefix' | 'path-prefix' | 'ipv4' | 'cidr' | 'unknown';
  value: string;
  /** Raw unparsed glob, used for url-prefix/path-prefix glob suffixes. */
  glob?: string;
}

// ─── Parsing ─────────────────────────────────────────────────────────────

export function parseScopeRules(scope: string): ScopeRule[] {
  if (!scope) return [];
  const rules: ScopeRule[] = [];
  for (const rawLine of scope.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    let kind: ScopeRule['kind'] = 'include';
    let body = line;
    if (/^\s*[!\-]/.test(line)) {
      kind = 'exclude';
      body = line.replace(/^\s*[!\-]\s*/, '');
    } else if (/^\s*out\s*:/i.test(line)) {
      kind = 'exclude';
      body = line.replace(/^\s*out\s*:\s*/i, '');
    } else if (/^\s*\+/.test(line)) {
      kind = 'include';
      body = line.replace(/^\s*\+\s*/, '');
    } else if (/^\s*in\s*:/i.test(line)) {
      kind = 'include';
      body = line.replace(/^\s*in\s*:\s*/i, '');
    }

    body = body.trim();
    if (!body) continue;

    rules.push({ raw: line, kind, pattern: parsePattern(body) });
  }
  return rules;
}

function parsePattern(body: string): ParsedPattern {
  const lower = body.toLowerCase();

  // CIDR notation
  if (/^\d+\.\d+\.\d+\.\d+\/\d{1,2}$/.test(body)) {
    return { type: 'cidr', value: body };
  }
  // IPv4 exact
  if (/^\d+\.\d+\.\d+\.\d+$/.test(body)) {
    return { type: 'ipv4', value: body };
  }
  // Full URL with scheme
  if (/^https?:\/\//i.test(body)) {
    return { type: 'url-prefix', value: body, glob: body };
  }
  // Path-only patterns
  if (body.startsWith('/')) {
    return { type: 'path-prefix', value: body, glob: body };
  }
  // Wildcard subdomain
  if (lower.startsWith('*.')) {
    return { type: 'host-wildcard', value: lower.slice(2) };
  }
  if (lower.includes('*')) {
    return { type: 'host-wildcard', value: lower.replace(/^\*\./, '').replace(/\*/g, '') };
  }
  // Host (we treat bare hosts as "this host or any subdomain" because that's
  // how almost every program phrases scope).
  if (/^[a-z0-9.\-]+$/.test(lower) && lower.includes('.')) {
    return { type: 'host-suffix', value: lower };
  }
  return { type: 'unknown', value: body };
}

// ─── Matching ────────────────────────────────────────────────────────────

interface ParsedTarget {
  url: URL | null;
  host: string;
  path: string;
  full: string;
}

function parseInput(input: string): ParsedTarget {
  const trimmed = input.trim();
  // Allow bare hostnames by wrapping them in https://
  const candidate = /^[a-z][a-z0-9+\-.]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return {
      url,
      host: url.hostname.toLowerCase(),
      path: url.pathname + url.search,
      full: url.toString()
    };
  } catch {
    return { url: null, host: trimmed.toLowerCase(), path: '', full: trimmed };
  }
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function matchPattern(pattern: ParsedPattern, t: ParsedTarget): { matched: boolean; specificity: number } {
  switch (pattern.type) {
    case 'host-exact':
      return { matched: t.host === pattern.value, specificity: pattern.value.length };
    case 'host-wildcard':
      // *.example.com matches any depth of subdomain but NOT example.com itself
      // (matches HackerOne semantics).
      return {
        matched: t.host.endsWith(`.${pattern.value}`),
        specificity: pattern.value.length + 5
      };
    case 'host-suffix':
      return {
        matched: t.host === pattern.value || t.host.endsWith(`.${pattern.value}`),
        specificity: pattern.value.length
      };
    case 'url-prefix': {
      const glob = pattern.glob ?? pattern.value;
      const cleanGlob = glob.replace(/\*+$/, '');
      return {
        matched: t.full.startsWith(cleanGlob),
        specificity: cleanGlob.length + 50 // URL matches are very specific
      };
    }
    case 'path-prefix': {
      const glob = pattern.glob ?? pattern.value;
      const cleanGlob = glob.replace(/\*+$/, '');
      return {
        matched: t.path.startsWith(cleanGlob),
        specificity: cleanGlob.length + 10
      };
    }
    case 'ipv4': {
      return { matched: t.host === pattern.value, specificity: 32 };
    }
    case 'cidr': {
      const [ip, bits] = pattern.value.split('/');
      const targetInt = ipv4ToInt(t.host);
      const subnetInt = ipv4ToInt(ip);
      if (targetInt == null || subnetInt == null) return { matched: false, specificity: 0 };
      const prefix = parseInt(bits, 10);
      if (!Number.isFinite(prefix) || prefix < 0 || prefix > 32) return { matched: false, specificity: 0 };
      const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
      return { matched: (targetInt & mask) === (subnetInt & mask), specificity: prefix };
    }
    default:
      return { matched: false, specificity: 0 };
  }
}

export function evaluateScope(input: string, rules: ScopeRule[]): ScopeMatch {
  if (rules.length === 0) {
    return {
      verdict: 'no-rules',
      reason: 'No scope rules are defined for this target.',
      specificity: 0
    };
  }
  const target = parseInput(input);
  let best: { rule: ScopeRule; specificity: number } | null = null;

  for (const rule of rules) {
    const { matched, specificity } = matchPattern(rule.pattern, target);
    if (!matched) continue;
    if (
      !best ||
      specificity > best.specificity ||
      // Tie-breaker: excludes win against equal-specificity includes.
      (specificity === best.specificity && rule.kind === 'exclude' && best.rule.kind === 'include')
    ) {
      best = { rule, specificity };
    }
  }

  if (!best) {
    return {
      verdict: 'out-of-scope',
      reason: 'No rule matched this URL.',
      specificity: 0
    };
  }

  return {
    verdict: best.rule.kind === 'include' ? 'in-scope' : 'out-of-scope',
    matchedRule: best.rule,
    reason: `Matched ${best.rule.kind === 'include' ? 'include' : 'exclude'} rule: ${best.rule.raw}`,
    specificity: best.specificity
  };
}
