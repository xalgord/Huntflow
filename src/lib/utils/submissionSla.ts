/**
 * SLA + ROI calculations for submissions.
 *
 * Programs publish wildly different SLAs and most don't honor them anyway.
 * The numbers below are pragmatic baselines collected from observing public
 * H1/BC programs — they're configurable per platform and intended to flag
 * "this report has gone cold, follow up" rather than to be authoritative.
 */

import type { Platform, Session, Submission, SubmissionStatus } from '$lib/types';

export type SlaPhase = 'triage' | 'resolution' | 'reward';
export type SlaState = 'within' | 'approaching' | 'overdue' | 'completed' | 'pending';

export interface SlaTarget {
  /** Days from submission until first triage response. */
  triageDays: number;
  /** Days from triage until resolution decision. */
  resolutionDays: number;
  /** Days from resolution until bounty reward. */
  rewardDays: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Platform-specific defaults. Conservative — we'd rather flag green for
// programs that respond fast than constantly nag the user about programs
// that take their time.
const DEFAULT_SLA: Record<Platform, SlaTarget> = {
  hackerone: { triageDays: 3, resolutionDays: 30, rewardDays: 14 },
  bugcrowd: { triageDays: 5, resolutionDays: 30, rewardDays: 14 },
  intigriti: { triageDays: 5, resolutionDays: 30, rewardDays: 14 },
  yeswehack: { triageDays: 5, resolutionDays: 30, rewardDays: 14 },
  synack: { triageDays: 2, resolutionDays: 21, rewardDays: 7 },
  'self-hosted': { triageDays: 7, resolutionDays: 60, rewardDays: 30 },
  other: { triageDays: 7, resolutionDays: 45, rewardDays: 21 }
};

export function getSlaTarget(platform: Platform): SlaTarget {
  return DEFAULT_SLA[platform] ?? DEFAULT_SLA.other;
}

export interface SlaStatus {
  phase: SlaPhase;
  state: SlaState;
  /** Number of days elapsed in the current phase (negative if not started). */
  daysElapsed: number;
  /** Days until phase deadline (negative if overdue, undefined if completed). */
  daysRemaining?: number;
  /** Hint shown to the user. */
  message: string;
}

/**
 * Determine which phase a submission is currently in and how it's tracking
 * against the platform's SLA. We always return the *active* phase — once a
 * report is rewarded the SLA is `completed`.
 */
export function calculateSla(submission: Submission, now: number = Date.now()): SlaStatus {
  const sla = getSlaTarget(submission.platform);

  // Terminal states
  if (submission.status === 'rewarded' && submission.rewardedAt) {
    return {
      phase: 'reward',
      state: 'completed',
      daysElapsed: daysBetween(submission.submittedAt ?? submission.createdAt, submission.rewardedAt),
      message: 'Rewarded'
    };
  }
  if (submission.status === 'closed' || submission.status === 'duplicate' ||
      submission.status === 'informational' || submission.status === 'not-applicable') {
    return {
      phase: 'resolution',
      state: 'completed',
      daysElapsed: 0,
      message: humanStatus(submission.status)
    };
  }

  // Draft hasn't started any clock yet.
  if (submission.status === 'draft') {
    return { phase: 'triage', state: 'pending', daysElapsed: 0, message: 'Draft — not submitted' };
  }

  const submittedAt = submission.submittedAt ?? submission.createdAt;

  // Phase 3: Resolved, awaiting reward
  if (submission.status === 'resolved' && submission.resolvedAt) {
    const elapsed = daysBetween(submission.resolvedAt, now);
    return buildStatus('reward', elapsed, sla.rewardDays, 'reward');
  }

  // Phase 2: Triaged/accepted, awaiting resolution
  if ((submission.status === 'triaged' || submission.status === 'accepted') && submission.triagedAt) {
    const elapsed = daysBetween(submission.triagedAt, now);
    return buildStatus('resolution', elapsed, sla.resolutionDays, 'resolution');
  }

  // Phase 1: Submitted, awaiting triage
  const elapsed = daysBetween(submittedAt, now);
  return buildStatus('triage', elapsed, sla.triageDays, 'triage');
}

function buildStatus(
  phase: SlaPhase,
  elapsed: number,
  target: number,
  label: 'triage' | 'resolution' | 'reward'
): SlaStatus {
  const remaining = target - elapsed;
  let state: SlaState;
  let message: string;

  if (remaining < 0) {
    state = 'overdue';
    message = `Overdue · ${Math.abs(Math.round(remaining))}d past ${label} SLA`;
  } else if (remaining <= Math.max(1, Math.floor(target * 0.25))) {
    state = 'approaching';
    message = `${Math.round(remaining)}d until ${label} SLA`;
  } else {
    state = 'within';
    message = `${Math.round(remaining)}d until ${label} SLA`;
  }

  return { phase, state, daysElapsed: elapsed, daysRemaining: remaining, message };
}

function daysBetween(start: number, end: number): number {
  return Math.max(0, (end - start) / DAY_MS);
}

function humanStatus(status: SubmissionStatus): string {
  switch (status) {
    case 'duplicate':
      return 'Closed — duplicate';
    case 'informational':
      return 'Closed — informational';
    case 'not-applicable':
      return 'Closed — not applicable';
    case 'closed':
      return 'Closed';
    default:
      return status;
  }
}

// ─── ROI / acceptance ────────────────────────────────────────────────────

export interface SubmissionROI {
  /** Total minutes spent in sessions on this target. */
  minutesSpent: number;
  /** Bounty earned for this target across all submissions. */
  bountyEarned: number;
  /** $/hour rate, only meaningful when minutesSpent > 0. */
  hourlyRate: number;
  /** Submissions that resulted in a bounty. */
  rewardedCount: number;
  /** Submissions that ended in a non-rewarded terminal state. */
  rejectedCount: number;
  /** Acceptance % — rewarded / (rewarded + rejected). 0 if no terminals. */
  acceptanceRate: number;
}

const REJECTED_STATUSES: SubmissionStatus[] = ['duplicate', 'informational', 'not-applicable', 'closed'];

export function calculateRoi(
  targetId: string,
  submissions: Submission[],
  sessions: Session[]
): SubmissionROI {
  const targetSubs = submissions.filter((s) => s.targetId === targetId);
  const targetSessions = sessions.filter((s) => s.targetId === targetId);

  const minutesSpent = Math.round(
    targetSessions.reduce((sum, s) => sum + (s.durationActual ?? 0), 0) / 60
  );
  const bountyEarned = targetSubs.reduce((sum, s) => sum + (s.bountyAmount ?? 0), 0);

  const rewardedCount = targetSubs.filter((s) => s.status === 'rewarded').length;
  const rejectedCount = targetSubs.filter((s) => REJECTED_STATUSES.includes(s.status)).length;
  const totalDecided = rewardedCount + rejectedCount;

  return {
    minutesSpent,
    bountyEarned,
    hourlyRate: minutesSpent > 0 ? (bountyEarned / minutesSpent) * 60 : 0,
    rewardedCount,
    rejectedCount,
    acceptanceRate: totalDecided > 0 ? (rewardedCount / totalDecided) * 100 : 0
  };
}

// ─── Weekly recap ────────────────────────────────────────────────────────

export interface WeeklyRecap {
  /** ISO week start (Monday 00:00 local time). */
  weekStart: number;
  /** Reports submitted this week. */
  submitted: number;
  /** Reports that transitioned to triaged/accepted this week. */
  triaged: number;
  /** Reports that landed a bounty this week. */
  rewarded: number;
  /** Bounty $ earned (rewardedAt within window). */
  bountyEarned: number;
  /** Total minutes hunted across sessions started in window. */
  minutesHunted: number;
  /** Sessions completed (durationActual > 0). */
  sessionsCompleted: number;
  /** Comparisons to the previous week. */
  delta: {
    submitted: number;
    bountyEarned: number;
    minutesHunted: number;
  };
}

/** Get Monday 00:00 of the week containing `ts`, in local time. */
export function startOfWeek(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  // getDay: Sunday=0..Saturday=6 → shift so Monday=0
  const dayIdx = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dayIdx);
  return d.getTime();
}

export function buildWeeklyRecap(
  submissions: Submission[],
  sessions: Session[],
  now: number = Date.now()
): WeeklyRecap {
  const thisStart = startOfWeek(now);
  const thisEnd = thisStart + 7 * DAY_MS;
  const lastStart = thisStart - 7 * DAY_MS;
  const lastEnd = thisStart;

  const inWindow = (ts: number | undefined, start: number, end: number): boolean =>
    typeof ts === 'number' && ts >= start && ts < end;

  const submitted = submissions.filter((s) => inWindow(s.submittedAt, thisStart, thisEnd)).length;
  const triaged = submissions.filter((s) => inWindow(s.triagedAt, thisStart, thisEnd)).length;
  const rewardedSubs = submissions.filter((s) => inWindow(s.rewardedAt, thisStart, thisEnd));
  const bountyEarned = rewardedSubs.reduce((sum, s) => sum + (s.bountyAmount ?? 0), 0);

  const sessionsThisWeek = sessions.filter((s) => inWindow(s.startedAt, thisStart, thisEnd));
  const minutesHunted = Math.round(
    sessionsThisWeek.reduce((sum, s) => sum + (s.durationActual ?? 0), 0) / 60
  );
  const sessionsCompleted = sessionsThisWeek.filter((s) => (s.durationActual ?? 0) > 0).length;

  // Last-week comparators
  const lastSubmitted = submissions.filter((s) => inWindow(s.submittedAt, lastStart, lastEnd)).length;
  const lastBounty = submissions
    .filter((s) => inWindow(s.rewardedAt, lastStart, lastEnd))
    .reduce((sum, s) => sum + (s.bountyAmount ?? 0), 0);
  const lastMinutes = Math.round(
    sessions
      .filter((s) => inWindow(s.startedAt, lastStart, lastEnd))
      .reduce((sum, s) => sum + (s.durationActual ?? 0), 0) / 60
  );

  return {
    weekStart: thisStart,
    submitted,
    triaged,
    rewarded: rewardedSubs.length,
    bountyEarned,
    minutesHunted,
    sessionsCompleted,
    delta: {
      submitted: submitted - lastSubmitted,
      bountyEarned: bountyEarned - lastBounty,
      minutesHunted: minutesHunted - lastMinutes
    }
  };
}
