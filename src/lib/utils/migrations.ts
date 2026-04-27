import type { Payout, Submission, SubmissionStatus, Target } from '$lib/types';
import { generateId } from '$lib/utils/id';

/**
 * Map a Payout's status onto the richer SubmissionStatus pipeline.
 */
function payoutStatusToSubmissionStatus(status: Payout['status']): SubmissionStatus {
  if (status === 'paid') return 'rewarded';
  if (status === 'triaged') return 'triaged';
  return 'submitted';
}

/**
 * Build a Submission record seeded from a legacy Payout row. The original Payout
 * is preserved so the income/tax export pipeline keeps working; we just link the
 * two together via `payoutIds` and `submissionId` on the payout.
 */
export function buildSubmissionFromPayout(
  payout: Payout,
  targets: Target[]
): { submission: Submission; updatedPayout: Payout } {
  const matchedTarget = targets.find(
    (target) => target.platform === payout.platform && target.name.toLowerCase() === payout.program.toLowerCase()
  );

  const status = payoutStatusToSubmissionStatus(payout.status);
  const now = Date.now();
  const submittedAt = payout.date;
  const rewardedAt = payout.status === 'paid' ? payout.date : undefined;

  const submissionId = payout.submissionId ?? generateId();

  const submission: Submission = {
    id: submissionId,
    title: `${payout.program} — ${payout.severity} ${payout.status === 'paid' ? 'reward' : 'report'}`,
    targetId: matchedTarget?.id ?? targets[0]?.id ?? '',
    platform: payout.platform,
    severity: payout.severity,
    bountyAmount: payout.status === 'paid' ? payout.amount : undefined,
    status,
    submittedAt,
    triagedAt: status === 'triaged' || rewardedAt ? submittedAt : undefined,
    rewardedAt,
    payoutIds: [payout.id],
    notes: 'Migrated from a legacy Payout record.',
    tags: ['migrated'],
    timeline: [
      {
        id: generateId(),
        status,
        at: submittedAt
      }
    ],
    createdAt: payout.createdAt,
    updatedAt: now
  };

  const updatedPayout: Payout = {
    ...payout,
    submissionId,
    updatedAt: now
  };

  return { submission, updatedPayout };
}
