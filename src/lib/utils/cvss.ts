import type { CvssBaseSeverity, CvssVector } from '$lib/types';

// CVSS 3.1 base metric calculator
// Reference: https://www.first.org/cvss/v3.1/specification-document

export type CvssAttackVector = 'N' | 'A' | 'L' | 'P';
export type CvssAttackComplexity = 'L' | 'H';
export type CvssPrivilegesRequired = 'N' | 'L' | 'H';
export type CvssUserInteraction = 'N' | 'R';
export type CvssScope = 'U' | 'C';
export type CvssImpact = 'N' | 'L' | 'H';

export interface CvssBaseMetrics {
  AV: CvssAttackVector;
  AC: CvssAttackComplexity;
  PR: CvssPrivilegesRequired;
  UI: CvssUserInteraction;
  S: CvssScope;
  C: CvssImpact;
  I: CvssImpact;
  A: CvssImpact;
}

export const CVSS_DEFAULT_METRICS: CvssBaseMetrics = {
  AV: 'N',
  AC: 'L',
  PR: 'N',
  UI: 'N',
  S: 'U',
  C: 'N',
  I: 'N',
  A: 'N'
};

interface MetricOption<T extends string> {
  value: T;
  label: string;
  description: string;
}

export const CVSS_METRIC_OPTIONS = {
  AV: [
    { value: 'N', label: 'Network', description: 'Remotely exploitable from across the internet.' },
    { value: 'A', label: 'Adjacent', description: 'Same physical or logical network (LAN, VPN).' },
    { value: 'L', label: 'Local', description: 'Local access (shell, SSH, console).' },
    { value: 'P', label: 'Physical', description: 'Physical access required.' }
  ] as MetricOption<CvssAttackVector>[],
  AC: [
    { value: 'L', label: 'Low', description: 'No special conditions; reliably exploitable.' },
    { value: 'H', label: 'High', description: 'Conditions outside the attacker\u2019s control are required.' }
  ] as MetricOption<CvssAttackComplexity>[],
  PR: [
    { value: 'N', label: 'None', description: 'Unauthenticated.' },
    { value: 'L', label: 'Low', description: 'Basic user-level privileges required.' },
    { value: 'H', label: 'High', description: 'Admin / root privileges required.' }
  ] as MetricOption<CvssPrivilegesRequired>[],
  UI: [
    { value: 'N', label: 'None', description: 'No user interaction required.' },
    { value: 'R', label: 'Required', description: 'Victim must perform an action (click a link, etc.).' }
  ] as MetricOption<CvssUserInteraction>[],
  S: [
    { value: 'U', label: 'Unchanged', description: 'Impact stays in the vulnerable component.' },
    { value: 'C', label: 'Changed', description: 'Impact spreads to other components / authorities.' }
  ] as MetricOption<CvssScope>[],
  C: [
    { value: 'N', label: 'None', description: 'No data confidentiality loss.' },
    { value: 'L', label: 'Low', description: 'Limited data disclosure.' },
    { value: 'H', label: 'High', description: 'Total data disclosure.' }
  ] as MetricOption<CvssImpact>[],
  I: [
    { value: 'N', label: 'None', description: 'No data integrity loss.' },
    { value: 'L', label: 'Low', description: 'Limited unauthorized modification.' },
    { value: 'H', label: 'High', description: 'Total integrity compromise.' }
  ] as MetricOption<CvssImpact>[],
  A: [
    { value: 'N', label: 'None', description: 'No availability impact.' },
    { value: 'L', label: 'Low', description: 'Reduced performance / interruptions.' },
    { value: 'H', label: 'High', description: 'Full denial of service.' }
  ] as MetricOption<CvssImpact>[]
};

export const CVSS_METRIC_LABELS: Record<keyof CvssBaseMetrics, string> = {
  AV: 'Attack Vector',
  AC: 'Attack Complexity',
  PR: 'Privileges Required',
  UI: 'User Interaction',
  S: 'Scope',
  C: 'Confidentiality',
  I: 'Integrity',
  A: 'Availability'
};

const AV_VALUES: Record<CvssAttackVector, number> = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
const AC_VALUES: Record<CvssAttackComplexity, number> = { L: 0.77, H: 0.44 };
const PR_VALUES_UNCHANGED: Record<CvssPrivilegesRequired, number> = { N: 0.85, L: 0.62, H: 0.27 };
const PR_VALUES_CHANGED: Record<CvssPrivilegesRequired, number> = { N: 0.85, L: 0.68, H: 0.5 };
const UI_VALUES: Record<CvssUserInteraction, number> = { N: 0.85, R: 0.62 };
const IMPACT_VALUES: Record<CvssImpact, number> = { N: 0, L: 0.22, H: 0.56 };

function roundUp(value: number): number {
  // CVSS 3.1 spec rounding: round to nearest at 1e-5, then round up to one
  // decimal place, with an early return when already at full precision.
  const int_input = Math.round(value * 100000);
  const decimal = int_input % 10000;
  return decimal === 0 ? int_input / 100000 : (Math.floor(int_input / 10000) + 1) / 10;
}

export function calculateCvss(metrics: CvssBaseMetrics): CvssVector {
  const iss = 1 - (1 - IMPACT_VALUES[metrics.C]) * (1 - IMPACT_VALUES[metrics.I]) * (1 - IMPACT_VALUES[metrics.A]);

  const impact =
    metrics.S === 'U'
      ? 6.42 * iss
      : 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15);

  const prValues = metrics.S === 'C' ? PR_VALUES_CHANGED : PR_VALUES_UNCHANGED;
  const exploitability = 8.22 * AV_VALUES[metrics.AV] * AC_VALUES[metrics.AC] * prValues[metrics.PR] * UI_VALUES[metrics.UI];

  let baseScore = 0;
  if (impact > 0) {
    const raw = metrics.S === 'U' ? Math.min(impact + exploitability, 10) : Math.min(1.08 * (impact + exploitability), 10);
    baseScore = roundUp(raw);
  }

  return {
    version: '3.1',
    vectorString: buildVectorString(metrics),
    baseScore,
    baseSeverity: severityFromScore(baseScore)
  };
}

export function buildVectorString(metrics: CvssBaseMetrics): string {
  return `CVSS:3.1/AV:${metrics.AV}/AC:${metrics.AC}/PR:${metrics.PR}/UI:${metrics.UI}/S:${metrics.S}/C:${metrics.C}/I:${metrics.I}/A:${metrics.A}`;
}

export function severityFromScore(score: number): CvssBaseSeverity {
  if (score === 0) return 'none';
  if (score <= 3.9) return 'low';
  if (score <= 6.9) return 'medium';
  if (score <= 8.9) return 'high';
  return 'critical';
}

const PARSE_KEYS: (keyof CvssBaseMetrics)[] = ['AV', 'AC', 'PR', 'UI', 'S', 'C', 'I', 'A'];

export function parseCvssVector(vector: string): CvssBaseMetrics | null {
  if (!vector || typeof vector !== 'string') return null;
  if (!getCvssVersion(vector)) return null;

  const parts = vector
    .split('/')
    .slice(1)
    .map((segment) => segment.trim().split(':'));

  const map: Record<string, string> = {};
  for (const [key, value] of parts) {
    if (key && value) map[key.toUpperCase()] = value.toUpperCase();
  }

  const metrics: Partial<CvssBaseMetrics> = {};
  for (const key of PARSE_KEYS) {
    const value = map[key];
    if (!value) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (metrics as any)[key] = value;
  }

  // Validate enum membership.
  const candidate = metrics as CvssBaseMetrics;
  for (const key of PARSE_KEYS) {
    const allowed = CVSS_METRIC_OPTIONS[key].map((option) => option.value);
    if (!allowed.includes(candidate[key] as never)) return null;
  }

  return candidate;
}

export function getCvssVersion(vector: string): '3.0' | '3.1' | null {
  if (!vector || typeof vector !== 'string') return null;
  const upper = vector.toUpperCase();
  if (upper.startsWith('CVSS:3.1/')) return '3.1';
  if (upper.startsWith('CVSS:3.0/')) return '3.0';
  return null;
}

export function formatCvssVersionWarning(vector: string): string {
  if (getCvssVersion(vector) === '3.0') {
    return 'CVSS 3.0 vector detected — calculations use the 3.1 spec. Re-export as CVSS:3.1 for full accuracy.';
  }
  return '';
}

export function severityToReportSeverity(severity: CvssBaseSeverity): 'critical' | 'high' | 'medium' | 'low' | 'informational' {
  if (severity === 'critical') return 'critical';
  if (severity === 'high') return 'high';
  if (severity === 'medium') return 'medium';
  if (severity === 'low') return 'low';
  return 'informational';
}

export function severityColorClass(severity: CvssBaseSeverity): string {
  if (severity === 'critical') return 'border-red-500/30 bg-red-500/15 text-red-300';
  if (severity === 'high') return 'border-orange-500/30 bg-orange-500/15 text-orange-300';
  if (severity === 'medium') return 'border-yellow-500/30 bg-yellow-500/15 text-yellow-300';
  if (severity === 'low') return 'border-sky-500/30 bg-sky-500/15 text-sky-300';
  return 'border-zinc-500/30 bg-zinc-700/30 text-zinc-300';
}
