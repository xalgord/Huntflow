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
 *   - "[::1]" / "::1"     → IPv6 exact host (bare or bracketed)
 *   - "[fe80::1]/64"      → IPv6 CIDR
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
  type:
    | 'host-wildcard'
    | 'host-exact'
    | 'host-suffix'
    | 'url-prefix'
    | 'path-prefix'
    | 'ipv4'
    | 'cidr'
    | 'ipv6'
    | 'ipv6-cidr'
    | 'unknown';
  value: string;
  /** Raw unparsed glob, used for url-prefix/path-prefix glob suffixes. */
  glob?: string;
  /** IPv6 CIDR prefix length (bits). */
  prefix?: number;
}

// ─── Parsing ─────────────────────────────────────────────────────────────

/**
 * Canonicalize a hostname: lowercase and strip a single trailing dot.
 * Applied to both rule values and the parsed target host so trailing-dot
 * FQDNs (`example.com.`) compare equal to their dotless form. IPv6
 * literals keep their brackets here; use {@link stripIpv6Brackets} for
 * bare-address comparison.
 */
function normalizeHost(h: string): string {
  return h.toLowerCase().replace(/\.$/, '');
}

/**
 * Strip the leading `[` and trailing `]` from an IPv6 literal. `new URL`
 * returns bracketed hosts like `[::1]`; we compare against the bare form.
 */
function stripIpv6Brackets(h: string): string {
  return h.replace(/^\[/, '').replace(/\]$/, '');
}

const IPV4_RE = /^\d+\.\d+\.\d+\.\d+$/;
const IPV6_BRACKETED_RE = /^\[[0-9a-fA-F:]+\]$/;
const IPV6_BARE_RE = /^[0-9a-fA-F:]+$/;

/**
 * Recognize a rule value as an IPv6 literal, either bracketed (`[::1]`),
 * bare (`::1`), or with an optional `/prefix` CIDR suffix. Returns the
 * normalized bare address and optional prefix, or null if not IPv6.
 */
function parseIpv6Literal(body: string): { addr: string; prefix?: number } | null {
  let value = body.trim();
  let prefix: number | undefined;
  // Bracketed form, possibly with CIDR: "[::1]" or "[fe80::1]/64"
  if (value.startsWith('[')) {
    const close = value.indexOf(']');
    if (close === -1) return null;
    const addr = stripIpv6Brackets(value.slice(0, close + 1));
    const rest = value.slice(close + 1);
    if (rest === '') {
      return { addr: addr.toLowerCase() };
    }
    if (rest.startsWith('/')) {
      const p = parseInt(rest.slice(1), 10);
      if (!Number.isFinite(p) || p < 0 || p > 128) return null;
      return { addr: addr.toLowerCase(), prefix: p };
    }
    return null;
  }
  // Bare form, possibly with CIDR: "::1" or "fe80::1/64"
  if (value.includes('/')) {
    const [addr, pStr] = value.split('/');
    if (!IPV6_BARE_RE.test(addr)) return null;
    const p = parseInt(pStr, 10);
    if (!Number.isFinite(p) || p < 0 || p > 128) return null;
    return { addr: addr.toLowerCase(), prefix: p };
  }
  // A bare IPv6 host must contain at least one `:` to be distinguishable
  // from a regular hostname; otherwise leave it to the host branches.
  if (IPV6_BARE_RE.test(value) && value.includes(':')) {
    return { addr: value.toLowerCase() };
  }
  return null;
}

/**
 * Expand an IPv6 address (bare, no brackets) into 16 bytes. Handles `::`
 * zero-compression. Returns null when the address is malformed.
 */
function ipv6ToBytes(addr: string): Uint8Array | null {
  const cleaned = stripIpv6Brackets(addr).toLowerCase();
  if (cleaned.length === 0) return null;
  // Reject anything with a stray IPv4-in-IPv6 tail or non-hex group chars
  // beyond `:` — keep this conservative and well-defined.
  if (!/^[0-9a-f:]+$/.test(cleaned)) return null;

  let head: string[];
  let tail: string[] = [];
  if (cleaned.includes('::')) {
    const parts = cleaned.split('::');
    if (parts.length !== 2) return null; // only one `::` allowed
    head = parts[0] === '' ? [] : parts[0].split(':');
    tail = parts[1] === '' ? [] : parts[1].split(':');
    const fill = 8 - head.length - tail.length;
    if (fill < 0) return null;
    const groups = [...head, ...Array(fill).fill('0'), ...tail];
    return groupsToBytes(groups);
  }
  const groups = cleaned.split(':');
  return groupsToBytes(groups);
}

function groupsToBytes(groups: string[]): Uint8Array | null {
  if (groups.length !== 8) return null;
  const out = new Uint8Array(16);
  for (let i = 0; i < 8; i += 1) {
    const g = groups[i];
    if (g === '' || !/^[0-9a-f]{1,4}$/.test(g)) return null;
    const v = parseInt(g, 16);
    if (!Number.isFinite(v) || v < 0 || v > 0xffff) return null;
    out[i * 2] = (v >> 8) & 0xff;
    out[i * 2 + 1] = v & 0xff;
  }
  return out;
}

/**
 * Canonicalize a rule IPv4 value through the same URL parser targets use,
 * so octal/hex variants (`010.0.0.5` → `8.0.0.5`) agree with the target.
 * Falls back to the raw value if the URL parser rejects it.
 */
function canonicalizeIpv4(value: string): string {
  try {
    return new URL(`http://${value}`).hostname;
  } catch {
    return value;
  }
}

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

  // CIDR notation (IPv4)
  if (/^\d+\.\d+\.\d+\.\d+\/\d{1,2}$/.test(body)) {
    return { type: 'cidr', value: body };
  }
  // IPv4 exact — canonicalize through URL so octal/hex forms match the
  // target host's normalized form (new URL collapses 010.0.0.5 → 8.0.0.5).
  if (IPV4_RE.test(body)) {
    return { type: 'ipv4', value: canonicalizeIpv4(body) };
  }
  // IPv6 literal: bracketed ([::1]), bare (::1), or with CIDR ([::1]/64).
  const ipv6 = parseIpv6Literal(body);
  if (ipv6) {
    if (ipv6.prefix !== undefined) {
      return { type: 'ipv6-cidr', value: ipv6.addr, prefix: ipv6.prefix };
    }
    return { type: 'ipv6', value: ipv6.addr };
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
    return { type: 'host-wildcard', value: normalizeHost(lower.slice(2)) };
  }
  if (lower.includes('*')) {
    return { type: 'host-wildcard', value: normalizeHost(lower.replace(/^\*\./, '').replace(/\*/g, '')) };
  }
  // Host (we treat bare hosts as "this host or any subdomain" because that's
  // how almost every program phrases scope).
  if (/^[a-z0-9.\-]+$/.test(lower) && lower.includes('.')) {
    return { type: 'host-suffix', value: normalizeHost(lower) };
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
      host: normalizeHost(url.hostname),
      path: url.pathname + url.search,
      full: url.toString()
    };
  } catch {
    return { url: null, host: normalizeHost(trimmed), path: '', full: trimmed };
  }
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Compare the first `prefixBits` bits of two byte arrays (IPv6 prefix
 * match). Returns true if they are equal over the prefix length.
 */
function compareBytes(a: Uint8Array, b: Uint8Array, prefixBits: number): boolean {
  if (prefixBits <= 0) return true;
  const fullBytes = Math.floor(prefixBits / 8);
  for (let i = 0; i < fullBytes; i++) {
    if (a[i] !== b[i]) return false;
  }
  const remaining = prefixBits % 8;
  if (remaining > 0 && fullBytes < a.length && fullBytes < b.length) {
    const mask = 0xff << (8 - remaining);
    if ((a[fullBytes] & mask) !== (b[fullBytes] & mask)) return false;
  }
  return true;
}

function matchPattern(pattern: ParsedPattern, t: ParsedTarget): { matched: boolean; specificity: number } {
  switch (pattern.type) {
    case 'host-exact':
      return { matched: normalizeHost(t.host) === pattern.value, specificity: pattern.value.length };
    case 'host-wildcard':
      // *.example.com matches any depth of subdomain but NOT example.com itself
      // (matches HackerOne semantics).
      return {
        matched: normalizeHost(t.host).endsWith(`.${pattern.value}`),
        specificity: pattern.value.length + 5
      };
    case 'host-suffix':
      return {
        matched: normalizeHost(t.host) === pattern.value || normalizeHost(t.host).endsWith(`.${pattern.value}`),
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
    case 'ipv6': {
      const targetAddr = stripIpv6Brackets(t.host).toLowerCase();
      if (!targetAddr.includes(':')) return { matched: false, specificity: 0 };
      const targetBytes = ipv6ToBytes(targetAddr);
      const ruleBytes = ipv6ToBytes(pattern.value);
      if (!targetBytes || !ruleBytes) return { matched: false, specificity: 0 };
      return { matched: compareBytes(targetBytes, ruleBytes, 128), specificity: 128 };
    }
    case 'ipv6-cidr': {
      const targetAddr = stripIpv6Brackets(t.host).toLowerCase();
      if (!targetAddr.includes(':')) return { matched: false, specificity: 0 };
      const targetBytes = ipv6ToBytes(targetAddr);
      const ruleBytes = ipv6ToBytes(pattern.value);
      if (!targetBytes || !ruleBytes) return { matched: false, specificity: 0 };
      const prefix = pattern.prefix ?? 128;
      return { matched: compareBytes(targetBytes, ruleBytes, prefix), specificity: prefix };
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
