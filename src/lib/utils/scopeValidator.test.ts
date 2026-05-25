import { describe, expect, it } from 'vitest';
import { parseScopeRules, evaluateScope } from './scopeValidator';

describe('parseScopeRules', () => {
  it('returns empty array for empty input', () => {
    expect(parseScopeRules('')).toEqual([]);
    expect(parseScopeRules('   ')).toEqual([]);
  });

  it('ignores comments (# and //)', () => {
    const rules = parseScopeRules('# comment\n// another\nexample.com');
    expect(rules).toHaveLength(1);
    expect(rules[0].pattern.value).toBe('example.com');
  });

  it('defaults bare lines to include', () => {
    const rules = parseScopeRules('example.com');
    expect(rules).toHaveLength(1);
    expect(rules[0].kind).toBe('include');
  });

  it('parses + prefix as include', () => {
    const rules = parseScopeRules('+example.com');
    expect(rules[0].kind).toBe('include');
  });

  it('parses - prefix as exclude', () => {
    const rules = parseScopeRules('-admin.example.com');
    expect(rules[0].kind).toBe('exclude');
  });

  it('parses ! prefix as exclude', () => {
    const rules = parseScopeRules('!admin.example.com');
    expect(rules[0].kind).toBe('exclude');
  });

  it('parses "out:" prefix as exclude', () => {
    const rules = parseScopeRules('out:admin.example.com');
    expect(rules[0].kind).toBe('exclude');
  });

  it('parses "in:" prefix as include', () => {
    const rules = parseScopeRules('in:example.com');
    expect(rules[0].kind).toBe('include');
  });

  it('parses wildcard host pattern', () => {
    const rules = parseScopeRules('*.example.com');
    expect(rules[0].pattern.type).toBe('host-wildcard');
    expect(rules[0].pattern.value).toBe('example.com');
  });

  it('parses URL prefix pattern', () => {
    const rules = parseScopeRules('https://example.com/api/*');
    expect(rules[0].pattern.type).toBe('url-prefix');
  });

  it('parses path prefix pattern', () => {
    const rules = parseScopeRules('/api/*');
    expect(rules[0].pattern.type).toBe('path-prefix');
  });

  it('parses IPv4 pattern', () => {
    const rules = parseScopeRules('192.168.1.1');
    expect(rules[0].pattern.type).toBe('ipv4');
    expect(rules[0].pattern.value).toBe('192.168.1.1');
  });

  it('parses CIDR pattern', () => {
    const rules = parseScopeRules('10.0.0.0/24');
    expect(rules[0].pattern.type).toBe('cidr');
    expect(rules[0].pattern.value).toBe('10.0.0.0/24');
  });

  it('parses host-suffix pattern for bare hostnames', () => {
    const rules = parseScopeRules('example.com');
    expect(rules[0].pattern.type).toBe('host-suffix');
  });
});

describe('evaluateScope', () => {
  it('returns no-rules for empty rules', () => {
    const result = evaluateScope('https://example.com', []);
    expect(result.verdict).toBe('no-rules');
  });

  it('matches in-scope for wildcard subdomain', () => {
    const rules = parseScopeRules('*.example.com');
    expect(evaluateScope('https://api.example.com', rules).verdict).toBe('in-scope');
    expect(evaluateScope('https://deep.sub.example.com', rules).verdict).toBe('in-scope');
  });

  it('does not match base domain for wildcard', () => {
    const rules = parseScopeRules('*.example.com');
    expect(evaluateScope('https://example.com', rules).verdict).toBe('out-of-scope');
  });

  it('matches host-suffix for base domain and subdomains', () => {
    const rules = parseScopeRules('example.com');
    expect(evaluateScope('https://example.com', rules).verdict).toBe('in-scope');
    expect(evaluateScope('https://sub.example.com', rules).verdict).toBe('in-scope');
  });

  it('matches URL prefix', () => {
    const rules = parseScopeRules('https://example.com/api/*');
    expect(evaluateScope('https://example.com/api/users', rules).verdict).toBe('in-scope');
    expect(evaluateScope('https://example.com/other', rules).verdict).toBe('out-of-scope');
  });

  it('matches path prefix', () => {
    const rules = parseScopeRules('/api/*');
    expect(evaluateScope('https://anyhost.com/api/users', rules).verdict).toBe('in-scope');
    expect(evaluateScope('https://anyhost.com/other', rules).verdict).toBe('out-of-scope');
  });

  it('matches exact IPv4', () => {
    const rules = parseScopeRules('192.168.1.1');
    expect(evaluateScope('192.168.1.1', rules).verdict).toBe('in-scope');
    expect(evaluateScope('192.168.1.2', rules).verdict).toBe('out-of-scope');
  });

  it('matches CIDR range', () => {
    const rules = parseScopeRules('10.0.0.0/24');
    expect(evaluateScope('10.0.0.1', rules).verdict).toBe('in-scope');
    expect(evaluateScope('10.0.0.254', rules).verdict).toBe('in-scope');
    expect(evaluateScope('10.0.1.1', rules).verdict).toBe('out-of-scope');
  });

  it('exclude overrides include at equal specificity', () => {
    const rules = parseScopeRules('example.com\n-admin.example.com');
    expect(evaluateScope('https://example.com', rules).verdict).toBe('in-scope');
    expect(evaluateScope('https://admin.example.com', rules).verdict).toBe('out-of-scope');
  });

  it('more specific rule wins', () => {
    const rules = parseScopeRules('*.example.com\n-https://admin.example.com/*');
    expect(evaluateScope('https://api.example.com', rules).verdict).toBe('in-scope');
    expect(evaluateScope('https://admin.example.com/panel', rules).verdict).toBe('out-of-scope');
  });

  it('handles bare hostname input (no scheme)', () => {
    const rules = parseScopeRules('*.example.com');
    expect(evaluateScope('api.example.com', rules).verdict).toBe('in-scope');
  });
});
