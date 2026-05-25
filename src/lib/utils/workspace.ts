import type {
  Platform,
  PayoutSeverity,
  Priority,
  ReconAsset,
  ReconAssetStatus,
  ScopeStatus,
  SubmissionStatus,
  Target,
  TargetAssetType,
  TargetStatus
} from '$lib/types';

export const platformLabels: Record<Platform, string> = {
  hackerone: 'HackerOne',
  bugcrowd: 'Bugcrowd',
  intigriti: 'Intigriti',
  synack: 'Synack',
  yeswehack: 'YesWeHack',
  'self-hosted': 'Private',
  other: 'Other'
};

export const priorityLabels: Record<Priority, string> = {
  0: 'P0 Critical',
  1: 'P1 High',
  2: 'P2 Medium',
  3: 'P3 Low'
};

export const targetStatusLabels: Record<TargetStatus, string> = {
  recon: 'Watching',
  testing: 'Hunting',
  reported: 'Submitted',
  paid: 'Paid',
  closed: 'Paused',
  archived: 'Archived'
};

export const assetStatusLabels: Record<ReconAssetStatus, string> = {
  untested: 'New',
  'in-progress': 'Testing',
  tested: 'Done',
  safe: 'Done',
  vulnerable: 'Testing',
  'out-of-scope': 'Archived',
  dead: 'Blocked'
};

export const assetTypeLabels: Record<TargetAssetType, string> = {
  web: 'Web',
  api: 'API',
  mobile: 'Mobile',
  cloud: 'Cloud',
  'source-code': 'Source Code',
  other: 'Other'
};

export const scopeStatusLabels: Record<ScopeStatus, string> = {
  'in-scope': 'In scope',
  'out-of-scope': 'Out of scope',
  unknown: 'Unknown'
};

export const submissionStatusLabels: Record<SubmissionStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  triaged: 'Triaged',
  accepted: 'Accepted',
  duplicate: 'Duplicate',
  informational: 'Informative',
  'not-applicable': 'N/A',
  resolved: 'Resolved',
  rewarded: 'Paid',
  closed: 'Closed'
};

export const findingStatusLabels: Record<SubmissionStatus, string> = {
  draft: 'Lead',
  submitted: 'Submitted',
  triaged: 'Triaged',
  accepted: 'Accepted',
  duplicate: 'Duplicate',
  informational: 'Informative',
  'not-applicable': 'N/A',
  resolved: 'Resolved',
  rewarded: 'Paid',
  closed: 'Resolved'
};

export const severityLabels: Record<PayoutSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  informational: 'Info'
};

export function formatDate(timestamp?: number | null, fallback = 'Never'): string {
  if (!timestamp) return fallback;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(timestamp));
}

export function formatRelativeDate(timestamp?: number | null): string {
  if (!timestamp) return 'Never';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return formatDate(timestamp);
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.round((safe % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export function formatTimer(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function formatMoney(value: number, currency = 'USD', maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits
  }).format(value);
}

export function scopeStatusFor(asset: ReconAsset): ScopeStatus {
  if (asset.scopeStatus) return asset.scopeStatus;
  if (asset.status === 'out-of-scope') return 'out-of-scope';
  return asset.inScope ? 'in-scope' : 'out-of-scope';
}

export function assetTypeFor(asset: ReconAsset): TargetAssetType {
  if (asset.assetType) return asset.assetType;
  const haystack = `${asset.hostname} ${asset.url ?? ''} ${asset.technologies.join(' ')}`.toLowerCase();
  if (haystack.includes('api') || haystack.includes('graphql') || haystack.includes('swagger')) return 'api';
  if (haystack.includes('android') || haystack.includes('ios') || haystack.includes('mobile')) return 'mobile';
  if (haystack.includes('s3') || haystack.includes('aws') || haystack.includes('gcp') || haystack.includes('azure')) {
    return 'cloud';
  }
  return 'web';
}

export function lastProgramActivity(program: Target): number {
  return Math.max(program.lastSessionAt ?? 0, program.updatedAt ?? 0, program.createdAt ?? 0);
}

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function statusTone(status: string): BadgeTone {
  if (['critical', 'high', 'blocked', 'vulnerable', 'out-of-scope'].includes(status)) return 'danger';
  if (['medium', 'testing', 'submitted', 'triaged', 'pending', 'in-progress'].includes(status)) return 'warning';
  if (['paid', 'rewarded', 'resolved', 'accepted', 'safe', 'done'].includes(status)) return 'success';
  if (['low', 'informational', 'info'].includes(status)) return 'info';
  return 'neutral';
}

export function programUrlHost(program: Target): string {
  if (!program.programUrl) return 'No URL';
  try {
    return new URL(program.programUrl).host;
  } catch {
    return program.programUrl;
  }
}
