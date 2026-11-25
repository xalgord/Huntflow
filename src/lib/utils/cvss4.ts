/**
 * CVSS v4.0 base metrics.
 *
 * Scoring v4.0 requires FIRST's macro-vector lookup tables, so it's
 * delegated to `ae-cvss-calculator` (Apache-2.0), loaded on demand to keep
 * it out of the main bundle. Vector parsing/building is local.
 */

export type Cvss4MetricKey = 'AV' | 'AC' | 'AT' | 'PR' | 'UI' | 'VC' | 'VI' | 'VA' | 'SC' | 'SI' | 'SA';
export type Cvss4Metrics = Record<Cvss4MetricKey, string>;

export interface Cvss4MetricDefinition {
  key: Cvss4MetricKey;
  label: string;
  group: 'Exploitability' | 'Vulnerable system' | 'Subsequent systems';
  options: Array<{ value: string; label: string }>;
}

export const CVSS4_METRICS: Cvss4MetricDefinition[] = [
  {
    key: 'AV',
    label: 'Attack Vector',
    group: 'Exploitability',
    options: [
      { value: 'N', label: 'Network' },
      { value: 'A', label: 'Adjacent' },
      { value: 'L', label: 'Local' },
      { value: 'P', label: 'Physical' }
    ]
  },
  { key: 'AC', label: 'Attack Complexity', group: 'Exploitability', options: [{ value: 'L', label: 'Low' }, { value: 'H', label: 'High' }] },
  { key: 'AT', label: 'Attack Requirements', group: 'Exploitability', options: [{ value: 'N', label: 'None' }, { value: 'P', label: 'Present' }] },
  {
    key: 'PR',
    label: 'Privileges Required',
    group: 'Exploitability',
    options: [
      { value: 'N', label: 'None' },
      { value: 'L', label: 'Low' },
      { value: 'H', label: 'High' }
    ]
  },
  {
    key: 'UI',
    label: 'User Interaction',
    group: 'Exploitability',
    options: [
      { value: 'N', label: 'None' },
      { value: 'P', label: 'Passive' },
      { value: 'A', label: 'Active' }
    ]
  },
  ...(['VC', 'VI', 'VA'] as const).map((key) => ({
    key,
    label: key === 'VC' ? 'Confidentiality' : key === 'VI' ? 'Integrity' : 'Availability',
    group: 'Vulnerable system' as const,
    options: [
      { value: 'H', label: 'High' },
      { value: 'L', label: 'Low' },
      { value: 'N', label: 'None' }
    ]
  })),
  ...(['SC', 'SI', 'SA'] as const).map((key) => ({
    key,
    label: key === 'SC' ? 'Confidentiality' : key === 'SI' ? 'Integrity' : 'Availability',
    group: 'Subsequent systems' as const,
    options: [
      { value: 'H', label: 'High' },
      { value: 'L', label: 'Low' },
      { value: 'N', label: 'None' }
    ]
  }))
];

export const CVSS4_DEFAULTS: Cvss4Metrics = {
  AV: 'N',
  AC: 'L',
  AT: 'N',
  PR: 'N',
  UI: 'N',
  VC: 'N',
  VI: 'N',
  VA: 'N',
  SC: 'N',
  SI: 'N',
  SA: 'N'
};

const ORDER: Cvss4MetricKey[] = ['AV', 'AC', 'AT', 'PR', 'UI', 'VC', 'VI', 'VA', 'SC', 'SI', 'SA'];

export function buildCvss4Vector(metrics: Cvss4Metrics): string {
  return `CVSS:4.0/${ORDER.map((key) => `${key}:${metrics[key]}`).join('/')}`;
}

/** Parse the base metrics of a v4.0 vector; null if it isn't one. */
export function parseCvss4Vector(vector: string | undefined): Cvss4Metrics | null {
  if (!vector?.startsWith('CVSS:4.0/')) return null;
  const metrics: Partial<Cvss4Metrics> = {};
  for (const part of vector.slice('CVSS:4.0/'.length).split('/')) {
    const [key, value] = part.split(':');
    const definition = CVSS4_METRICS.find((metric) => metric.key === key);
    if (!definition) continue; // threat/environmental metrics are allowed but ignored here
    if (!definition.options.some((option) => option.value === value)) return null;
    metrics[key as Cvss4MetricKey] = value;
  }
  return ORDER.every((key) => metrics[key]) ? (metrics as Cvss4Metrics) : null;
}

type Cvss4Ctor = new (vector: string) => { calculateScores(): { overall?: number; base?: number } };
let ctorPromise: Promise<Cvss4Ctor> | null = null;

async function loadCalculator(): Promise<Cvss4Ctor> {
  ctorPromise ??= import('ae-cvss-calculator').then((module) => {
    const candidate = (module as unknown as { Cvss4P0?: Cvss4Ctor; default?: { Cvss4P0?: Cvss4Ctor } }).Cvss4P0 ??
      (module as unknown as { default?: { Cvss4P0?: Cvss4Ctor } }).default?.Cvss4P0;
    if (!candidate) throw new Error('CVSS 4.0 calculator unavailable');
    return candidate;
  });
  return ctorPromise;
}

/** Base score for a v4.0 vector, or null if it can't be scored. */
export async function scoreCvss4(vector: string): Promise<number | null> {
  if (!parseCvss4Vector(vector)) return null;
  try {
    const Calculator = await loadCalculator();
    const scores = new Calculator(vector).calculateScores();
    const score = scores.overall ?? scores.base;
    return typeof score === 'number' && Number.isFinite(score) ? Math.round(score * 10) / 10 : null;
  } catch {
    return null;
  }
}
