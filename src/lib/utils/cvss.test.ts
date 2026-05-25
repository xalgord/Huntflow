import { describe, expect, it } from 'vitest';
import {
  calculateCvss,
  buildVectorString,
  severityFromScore,
  parseCvssVector,
  severityToReportSeverity,
  severityColorClass,
  CVSS_DEFAULT_METRICS
} from './cvss';

describe('severityFromScore', () => {
  it('returns none for 0', () => {
    expect(severityFromScore(0)).toBe('none');
  });

  it('returns low for 0.1-3.9', () => {
    expect(severityFromScore(0.1)).toBe('low');
    expect(severityFromScore(3.9)).toBe('low');
  });

  it('returns medium for 4.0-6.9', () => {
    expect(severityFromScore(4.0)).toBe('medium');
    expect(severityFromScore(6.9)).toBe('medium');
  });

  it('returns high for 7.0-8.9', () => {
    expect(severityFromScore(7.0)).toBe('high');
    expect(severityFromScore(8.9)).toBe('high');
  });

  it('returns critical for 9.0-10.0', () => {
    expect(severityFromScore(9.0)).toBe('critical');
    expect(severityFromScore(10.0)).toBe('critical');
  });
});

describe('buildVectorString', () => {
  it('builds a correct CVSS 3.1 vector string', () => {
    const result = buildVectorString(CVSS_DEFAULT_METRICS);
    expect(result).toBe('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N');
  });

  it('reflects non-default metrics', () => {
    const result = buildVectorString({
      AV: 'L', AC: 'H', PR: 'H', UI: 'R', S: 'C', C: 'H', I: 'H', A: 'H'
    });
    expect(result).toBe('CVSS:3.1/AV:L/AC:H/PR:H/UI:R/S:C/C:H/I:H/A:H');
  });
});

describe('calculateCvss', () => {
  it('returns 0.0 for all-none metrics', () => {
    const result = calculateCvss(CVSS_DEFAULT_METRICS);
    expect(result.baseScore).toBe(0);
    expect(result.baseSeverity).toBe('none');
    expect(result.version).toBe('3.1');
  });

  it('calculates critical score for worst-case metrics', () => {
    const result = calculateCvss({
      AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'C', C: 'H', I: 'H', A: 'H'
    });
    expect(result.baseScore).toBe(10.0);
    expect(result.baseSeverity).toBe('critical');
  });

  it('calculates a known low-severity vector', () => {
    // CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:L/I:L/A:N → 3.7 Low
    const result = calculateCvss({
      AV: 'N', AC: 'H', PR: 'L', UI: 'R', S: 'U', C: 'L', I: 'L', A: 'N'
    });
    expect(result.baseScore).toBe(3.7);
    expect(result.baseSeverity).toBe('low');
  });

  it('calculates a known high-severity vector', () => {
    // CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N → 8.1 High
    const result = calculateCvss({
      AV: 'N', AC: 'L', PR: 'L', UI: 'N', S: 'U', C: 'H', I: 'H', A: 'N'
    });
    expect(result.baseScore).toBe(8.1);
    expect(result.baseSeverity).toBe('high');
  });

  it('includes vectorString in result', () => {
    const result = calculateCvss(CVSS_DEFAULT_METRICS);
    expect(result.vectorString).toBe('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N');
  });
});

describe('parseCvssVector', () => {
  it('parses a valid CVSS 3.1 vector string', () => {
    const result = parseCvssVector('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N');
    expect(result).not.toBeNull();
    expect(result!.AV).toBe('N');
    expect(result!.AC).toBe('L');
    expect(result!.PR).toBe('N');
    expect(result!.UI).toBe('N');
    expect(result!.S).toBe('U');
    expect(result!.C).toBe('H');
    expect(result!.I).toBe('H');
    expect(result!.A).toBe('N');
  });

  it('parses CVSS 3.0 vectors', () => {
    const result = parseCvssVector('CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N');
    expect(result).not.toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseCvssVector('')).toBeNull();
  });

  it('returns null for non-CVSS prefix', () => {
    expect(parseCvssVector('AV:N/AC:L')).toBeNull();
  });

  it('returns null for missing metric', () => {
    expect(parseCvssVector('CVSS:3.1/AV:N/AC:L')).toBeNull();
  });

  it('returns null for invalid metric value', () => {
    expect(parseCvssVector('CVSS:3.1/AV:X/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N')).toBeNull();
  });

  it('roundtrips with calculateCvss', () => {
    const metrics = { AV: 'N' as const, AC: 'L' as const, PR: 'L' as const, UI: 'N' as const, S: 'U' as const, C: 'H' as const, I: 'H' as const, A: 'N' as const };
    const vector = calculateCvss(metrics);
    const parsed = parseCvssVector(vector.vectorString);
    expect(parsed).toEqual(metrics);
  });
});

describe('severityToReportSeverity', () => {
  it('maps each CVSS severity to report severity', () => {
    expect(severityToReportSeverity('critical')).toBe('critical');
    expect(severityToReportSeverity('high')).toBe('high');
    expect(severityToReportSeverity('medium')).toBe('medium');
    expect(severityToReportSeverity('low')).toBe('low');
    expect(severityToReportSeverity('none')).toBe('informational');
  });
});

describe('severityColorClass', () => {
  it('returns non-empty CSS class for each severity', () => {
    const severities = ['critical', 'high', 'medium', 'low', 'none'] as const;
    for (const severity of severities) {
      const cls = severityColorClass(severity);
      expect(cls.length).toBeGreaterThan(0);
      expect(cls).toContain('border-');
    }
  });

  it('returns distinct classes for different severities', () => {
    const classes = new Set(
      (['critical', 'high', 'medium', 'low', 'none'] as const).map(severityColorClass)
    );
    expect(classes.size).toBe(5);
  });
});
