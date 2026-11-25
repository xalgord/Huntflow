/**
 * "Today" view model.
 *
 * Turns the local workspace into a short, ranked list of things a hunter
 * should act on — the way Reminders surfaces what's due rather than
 * showing every record. Pure functions so the ranking is unit-tested.
 */
import type { Note, Payout, ReconAsset, Session, Submission, Target } from '$lib/types';
import { calculateSla } from './submissionSla';

export type AttentionKind =
  | 'sla-overdue'
  | 'sla-approaching'
  | 'draft'
  | 'lead'
  | 'record-bounty'
  | 'payout-pending'
  | 'target'
  | 'backup';

export type AttentionTone = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray';

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  title: string;
  detail: string;
  href: string;
  tone: AttentionTone;
  /** Lower sorts first. */
  rank: number;
  at: number;
}

export interface AttentionInput {
  programs: Target[];
  submissions: Submission[];
  notes: Note[];
  payouts: Payout[];
  assets: ReconAsset[];
  /** Backup state; omit to skip the backup reminder. */
  backup?: { lastBackupAt?: number; automatic: boolean };
  now?: number;
}

const DAY = 86_400_000;
const BACKUP_REMINDER_AFTER = 14 * DAY;
const CLOSED_TARGET_STATUSES = new Set(['tested', 'safe', 'dead', 'out-of-scope']);

const severityWeight: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  informational: 4
};

function programName(programs: Map<string, Target>, id: string): string {
  return programs.get(id)?.name ?? 'Unknown program';
}

function days(ms: number): number {
  return Math.max(0, Math.floor(ms / DAY));
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export function buildAttentionQueue(input: AttentionInput): AttentionItem[] {
  const now = input.now ?? Date.now();
  const programs = new Map(input.programs.map((program) => [program.id, program]));
  const items: AttentionItem[] = [];

  for (const submission of input.submissions) {
    const program = programName(programs, submission.targetId);

    if (submission.status === 'draft') {
      const age = days(now - submission.createdAt);
      const sev = severityWeight[submission.severity] ?? 2;
      items.push({
        id: `draft:${submission.id}`,
        kind: 'draft',
        title: submission.title || 'Untitled finding',
        detail: `Draft for ${program} · ${age === 0 ? 'started today' : `${plural(age, 'day')} old`}`,
        href: `/findings?id=${submission.id}`,
        tone: sev <= 1 ? 'orange' : 'yellow',
        // High-severity and aging drafts float up: a duplicate risk grows daily.
        rank: 20 + sev * 4 - Math.min(age, 10),
        at: submission.updatedAt
      });
      continue;
    }

    const sla = calculateSla(submission, now);
    if (sla.state === 'overdue') {
      const late = Math.abs(Math.round(sla.daysRemaining ?? 0));
      const phaseText =
        sla.phase === 'triage' ? 'No triage response' : sla.phase === 'resolution' ? 'Fix overdue' : 'Bounty overdue';
      items.push({
        id: `sla:${submission.id}`,
        kind: 'sla-overdue',
        title: `${phaseText} — ${submission.title}`,
        detail: `${program} · ${plural(late, 'day')} past the usual ${sla.phase} time. Consider a polite follow-up.`,
        href: `/findings?id=${submission.id}`,
        tone: 'red',
        rank: 0 + (severityWeight[submission.severity] ?? 2),
        at: submission.updatedAt
      });
    } else if (sla.state === 'approaching') {
      items.push({
        id: `sla:${submission.id}`,
        kind: 'sla-approaching',
        title: submission.title,
        detail: `${program} · ${sla.message}`,
        href: `/findings?id=${submission.id}`,
        tone: 'orange',
        rank: 40 + (severityWeight[submission.severity] ?? 2),
        at: submission.updatedAt
      });
    }

    const hasPayout = (submission.payoutIds?.length ?? 0) > 0 || (submission.bountyAmount ?? 0) > 0;
    if (['resolved', 'rewarded'].includes(submission.status) && !hasPayout) {
      items.push({
        id: `bounty:${submission.id}`,
        kind: 'record-bounty',
        title: `Record the bounty for “${submission.title}”`,
        detail: `${program} · ${submission.status === 'rewarded' ? 'marked rewarded' : 'resolved'} but no payout logged`,
        href: `/payouts?new=1&submission=${submission.id}`,
        tone: 'green',
        rank: 50,
        at: submission.resolvedAt ?? submission.updatedAt
      });
    }
  }

  const promotedNotes = new Set(input.submissions.map((submission) => submission.noteId).filter(Boolean));
  for (const note of input.notes) {
    if (!note.severity || promotedNotes.has(note.id)) continue;
    if (note.severity === 'informational') continue;
    items.push({
      id: `lead:${note.id}`,
      kind: 'lead',
      title: `Promote lead: ${note.title || 'Untitled note'}`,
      detail: `${programName(programs, note.targetId)} · tagged ${note.severity}, not yet a finding`,
      href: `/notes/${note.id}`,
      tone: 'purple',
      rank: 30 + (severityWeight[note.severity] ?? 2),
      at: note.updatedAt
    });
  }

  for (const payout of input.payouts) {
    if (payout.status === 'paid') continue;
    const age = days(now - payout.date);
    items.push({
      id: `payout:${payout.id}`,
      kind: 'payout-pending',
      title: `${formatUsd(payout.amount)} pending from ${payout.program}`,
      detail: age > 30 ? `Awarded ${age} days ago — check the platform's payout status` : 'Awaiting payment',
      href: '/payouts',
      tone: age > 30 ? 'orange' : 'green',
      rank: age > 30 ? 45 : 60,
      at: payout.date
    });
  }

  const openTargets = input.assets
    .filter((asset) => !CLOSED_TARGET_STATUSES.has(asset.status) && asset.inScope !== false && asset.scopeStatus !== 'out-of-scope')
    .map((asset) => ({ asset, priority: asset.priority ?? programs.get(asset.targetId)?.priority ?? 3 }))
    .filter(({ priority }) => priority <= 1)
    .sort((a, b) => a.priority - b.priority || b.asset.updatedAt - a.asset.updatedAt)
    .slice(0, 3);
  for (const { asset, priority } of openTargets) {
    items.push({
      id: `target:${asset.id}`,
      kind: 'target',
      title: `Test ${asset.hostname}`,
      detail: `${programName(programs, asset.targetId)} · P${priority} · ${asset.status === 'in-progress' ? 'in progress' : 'untested'}`,
      href: `/targets?asset=${asset.id}`,
      tone: 'blue',
      rank: 70 + priority,
      at: asset.updatedAt
    });
  }

  const hasWork = input.programs.length > 0 && input.submissions.length + input.notes.length + input.assets.length > 0;
  if (input.backup && !input.backup.automatic && hasWork) {
    const last = input.backup.lastBackupAt;
    if (!last || now - last > BACKUP_REMINDER_AFTER) {
      items.push({
        id: 'backup',
        kind: 'backup',
        title: 'Back up your workspace',
        detail: last
          ? `Last backup ${days(now - last)} days ago — everything lives only in this browser`
          : 'No backup yet — everything lives only in this browser',
        href: '/settings#storage-safety-heading',
        tone: 'gray',
        rank: 80,
        at: last ?? 0
      });
    }
  }

  return items.sort((a, b) => a.rank - b.rank || b.at - a.at);
}

export interface WeekSummary {
  huntSeconds: number;
  sessions: number;
  submitted: number;
  inFlight: number;
  acceptanceRate: number | null;
  decided: number;
  earnedThisYear: number;
  pending: number;
}

const ACCEPTED = new Set(['accepted', 'resolved', 'rewarded']);
const REJECTED = new Set(['duplicate', 'informational', 'not-applicable']);
const IN_FLIGHT = new Set(['submitted', 'triaged', 'accepted']);

export function buildWeekSummary(
  sessions: Session[],
  submissions: Submission[],
  payouts: Payout[],
  now = Date.now()
): WeekSummary {
  const weekStart = now - 7 * DAY;
  const yearStart = new Date(new Date(now).getFullYear(), 0, 1).getTime();
  const weekSessions = sessions.filter((session) => session.status === 'completed' && session.startedAt >= weekStart);
  const accepted = submissions.filter((submission) => ACCEPTED.has(submission.status)).length;
  const rejected = submissions.filter((submission) => REJECTED.has(submission.status)).length;
  const decided = accepted + rejected;
  return {
    huntSeconds: weekSessions.reduce((sum, session) => sum + session.durationActual, 0),
    sessions: weekSessions.length,
    submitted: submissions.filter((submission) => (submission.submittedAt ?? 0) >= weekStart).length,
    inFlight: submissions.filter((submission) => IN_FLIGHT.has(submission.status)).length,
    acceptanceRate: decided === 0 ? null : accepted / decided,
    decided,
    earnedThisYear: payouts
      .filter((payout) => payout.status === 'paid' && payout.date >= yearStart)
      .reduce((sum, payout) => sum + payout.amount, 0),
    pending: payouts.filter((payout) => payout.status !== 'paid').reduce((sum, payout) => sum + payout.amount, 0)
  };
}

export type ActivityKind = 'session' | 'note' | 'finding' | 'payout';

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  href: string;
  at: number;
}

export function buildRecentActivity(
  input: Pick<AttentionInput, 'programs' | 'submissions' | 'notes' | 'payouts'> & { sessions: Session[] },
  limit = 8
): ActivityEntry[] {
  const programs = new Map(input.programs.map((program) => [program.id, program]));
  const entries: ActivityEntry[] = [];

  for (const session of input.sessions) {
    if (session.status !== 'completed') continue;
    const minutes = Math.round(session.durationActual / 60);
    entries.push({
      id: `session:${session.id}`,
      kind: 'session',
      title: `Hunted ${programName(programs, session.targetId)}`,
      detail: `${minutes} min session${session.quickNote ? ` · ${session.quickNote}` : ''}`,
      href: '/sessions',
      at: session.endedAt ?? session.startedAt
    });
  }

  for (const note of input.notes) {
    entries.push({
      id: `note:${note.id}`,
      kind: 'note',
      title: note.title || 'Untitled note',
      detail: `Note · ${programName(programs, note.targetId)}`,
      href: `/notes/${note.id}`,
      at: note.updatedAt
    });
  }

  for (const submission of input.submissions) {
    const last = submission.timeline?.[submission.timeline.length - 1];
    entries.push({
      id: `finding:${submission.id}`,
      kind: 'finding',
      title: submission.title,
      detail: `${last ? statusVerb(last.status) : 'Finding updated'} · ${programName(programs, submission.targetId)}`,
      href: `/findings?id=${submission.id}`,
      at: last?.at ?? submission.updatedAt
    });
  }

  for (const payout of input.payouts) {
    if (payout.status !== 'paid') continue;
    entries.push({
      id: `payout:${payout.id}`,
      kind: 'payout',
      title: `${formatUsd(payout.amount)} from ${payout.program}`,
      detail: 'Bounty paid',
      href: '/payouts',
      at: payout.date
    });
  }

  return entries.sort((a, b) => b.at - a.at).slice(0, limit);
}

function statusVerb(status: Submission['status']): string {
  switch (status) {
    case 'draft':
      return 'Drafted';
    case 'submitted':
      return 'Submitted';
    case 'triaged':
      return 'Triaged';
    case 'accepted':
      return 'Accepted';
    case 'duplicate':
      return 'Closed as duplicate';
    case 'informational':
      return 'Closed as informative';
    case 'not-applicable':
      return 'Closed as N/A';
    case 'resolved':
      return 'Resolved';
    case 'rewarded':
      return 'Rewarded';
    default:
      return 'Closed';
  }
}

export interface SetupStep {
  id: 'program' | 'scope' | 'session' | 'finding';
  title: string;
  detail: string;
  href: string;
  done: boolean;
}

/** First-run checklist, shown until the hunter has completed the loop once. */
export function buildSetupSteps(input: {
  programs: Target[];
  assets: ReconAsset[];
  sessions: Session[];
  submissions: Submission[];
}): SetupStep[] {
  return [
    {
      id: 'program',
      title: 'Add your first program',
      detail: 'A bug bounty program or pentest engagement you are authorised to test.',
      href: '/programs?new=1',
      done: input.programs.length > 0
    },
    {
      id: 'scope',
      title: 'Add in-scope targets',
      detail: 'Import scope from HackerOne or Bugcrowd, or subfinder and httpx results, so every note and finding knows where it belongs.',
      href: '/targets?import=1',
      done: input.assets.length > 0
    },
    {
      id: 'session',
      title: 'Run a focused session',
      detail: 'Time-box your testing; HuntFlow keeps the log for you.',
      href: '/timer',
      done: input.sessions.some((session) => session.status === 'completed')
    },
    {
      id: 'finding',
      title: 'Capture a finding',
      detail: 'Draft it while it is fresh, then export a platform-ready report.',
      href: '/findings?new=1',
      done: input.submissions.length > 0
    }
  ];
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}
