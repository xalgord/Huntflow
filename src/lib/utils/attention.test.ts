import { describe, expect, it } from 'vitest';
import type { Note, Payout, ReconAsset, Session, Submission, Target } from '$lib/types';
import { buildAttentionQueue, buildRecentActivity, buildSetupSteps, buildWeekSummary } from './attention';

const NOW = new Date('2026-11-26T12:00:00Z').getTime();
const DAY = 86_400_000;

const program: Target = {
  id: 'p1',
  name: 'Acme',
  platform: 'hackerone',
  scope: '*.acme.test',
  notes: '',
  priority: 1,
  status: 'testing',
  createdAt: NOW - 30 * DAY,
  updatedAt: NOW - DAY,
  sessionCount: 0
};

function submission(partial: Partial<Submission>): Submission {
  return {
    id: 's1',
    title: 'IDOR on orders',
    targetId: 'p1',
    platform: 'hackerone',
    severity: 'high',
    status: 'submitted',
    payoutIds: [],
    tags: [],
    timeline: [],
    createdAt: NOW - 10 * DAY,
    updatedAt: NOW - 2 * DAY,
    ...partial
  };
}

function asset(partial: Partial<ReconAsset>): ReconAsset {
  return {
    id: 'a1',
    targetId: 'p1',
    hostname: 'api.acme.test',
    status: 'untested',
    inScope: true,
    technologies: [],
    discoveredAt: NOW - DAY,
    createdAt: NOW - DAY,
    updatedAt: NOW - DAY,
    ...partial
  };
}

const empty = { programs: [program], submissions: [], notes: [], payouts: [], assets: [], now: NOW };

describe('buildAttentionQueue', () => {
  it('returns nothing for an empty workspace', () => {
    expect(buildAttentionQueue(empty)).toEqual([]);
  });

  it('ranks an overdue triage response above drafts and targets', () => {
    const items = buildAttentionQueue({
      ...empty,
      submissions: [
        submission({ id: 'late', submittedAt: NOW - 9 * DAY }),
        submission({ id: 'draft', status: 'draft', severity: 'low', createdAt: NOW - DAY })
      ],
      assets: [asset({})]
    });
    expect(items.map((item) => item.kind)).toEqual(['sla-overdue', 'draft', 'target']);
    expect(items[0].href).toBe('/findings?id=late');
    expect(items[0].title).toContain('No triage response');
  });

  it('floats older high-severity drafts above fresh low-severity ones', () => {
    const items = buildAttentionQueue({
      ...empty,
      submissions: [
        submission({ id: 'fresh-low', status: 'draft', severity: 'low', createdAt: NOW }),
        submission({ id: 'old-high', status: 'draft', severity: 'high', createdAt: NOW - 6 * DAY })
      ]
    });
    expect(items.map((item) => item.id)).toEqual(['draft:old-high', 'draft:fresh-low']);
  });

  it('asks to record a bounty for resolved findings without payouts', () => {
    const items = buildAttentionQueue({
      ...empty,
      submissions: [submission({ status: 'resolved', resolvedAt: NOW - DAY, triagedAt: NOW - 5 * DAY })]
    });
    expect(items.some((item) => item.kind === 'record-bounty')).toBe(true);

    const paid = buildAttentionQueue({
      ...empty,
      submissions: [submission({ status: 'resolved', resolvedAt: NOW - DAY, payoutIds: ['x'] })]
    });
    expect(paid.some((item) => item.kind === 'record-bounty')).toBe(false);
  });

  it('asks for a retest when one is pending, and only then', () => {
    const items = buildAttentionQueue({
      ...empty,
      submissions: [submission({ status: 'resolved', resolvedAt: NOW - 3 * DAY, retestStatus: 'pending', payoutIds: ['x'] })]
    });
    const retest = items.find((item) => item.kind === 'retest');
    expect(retest).toMatchObject({ title: 'Retest “IDOR on orders”', tone: 'blue', href: '/findings?id=s1' });
    expect(retest?.detail).toContain('fix reported 3 days ago');
    expect(items[0].kind).toBe('retest');

    const done = buildAttentionQueue({
      ...empty,
      submissions: [submission({ status: 'resolved', resolvedAt: NOW - 3 * DAY, retestStatus: 'fixed', payoutIds: ['x'] })]
    });
    expect(done.some((item) => item.kind === 'retest')).toBe(false);
  });

  it('suggests promoting severity-tagged notes that are not yet findings', () => {
    const note: Note = {
      id: 'n1',
      title: 'JWT alg none',
      content: '',
      targetId: 'p1',
      tags: [],
      severity: 'high',
      createdAt: NOW,
      updatedAt: NOW
    };
    expect(buildAttentionQueue({ ...empty, notes: [note] })[0].kind).toBe('lead');
    expect(
      buildAttentionQueue({ ...empty, notes: [note], submissions: [submission({ noteId: 'n1' })] }).some(
        (item) => item.kind === 'lead'
      )
    ).toBe(false);
  });

  it('only surfaces P0/P1 in-scope targets that still need testing', () => {
    const items = buildAttentionQueue({
      ...empty,
      programs: [{ ...program, priority: 3 }],
      assets: [
        asset({ id: 'p0', priority: 0 }),
        asset({ id: 'done', priority: 0, status: 'tested' }),
        asset({ id: 'oos', priority: 0, scopeStatus: 'out-of-scope' }),
        asset({ id: 'low' })
      ]
    });
    expect(items.map((item) => item.id)).toEqual(['target:p0']);
  });

  it('flags stale pending payouts', () => {
    const payout: Payout = {
      id: 'pay',
      program: 'Acme',
      platform: 'hackerone',
      severity: 'high',
      amount: 1500,
      date: NOW - 45 * DAY,
      status: 'pending',
      createdAt: NOW,
      updatedAt: NOW
    };
    const [item] = buildAttentionQueue({ ...empty, payouts: [payout] });
    expect(item.kind).toBe('payout-pending');
    expect(item.tone).toBe('orange');
    expect(item.title).toContain('$1,500');
  });
});

describe('backup reminder', () => {
  const withWork = { ...empty, assets: [asset({ status: 'tested' })] };

  it('reminds when there is work and no recent backup', () => {
    expect(buildAttentionQueue({ ...withWork, backup: { automatic: false } }).map((item) => item.kind)).toEqual(['backup']);
    expect(
      buildAttentionQueue({ ...withWork, backup: { automatic: false, lastBackupAt: NOW - 20 * DAY } })[0].detail
    ).toContain('20 days ago');
  });

  it('stays quiet with automatic backups, a recent backup or no work', () => {
    expect(buildAttentionQueue({ ...withWork, backup: { automatic: true } })).toEqual([]);
    expect(buildAttentionQueue({ ...withWork, backup: { automatic: false, lastBackupAt: NOW - DAY } })).toEqual([]);
    expect(buildAttentionQueue({ ...empty, backup: { automatic: false } })).toEqual([]);
  });
});

describe('buildWeekSummary', () => {
  it('summarises hunt time, pipeline and earnings', () => {
    const sessions: Session[] = [
      { id: 'x', targetId: 'p1', durationPlanned: 1500, durationActual: 1200, startedAt: NOW - DAY, status: 'completed', tags: [] },
      { id: 'y', targetId: 'p1', durationPlanned: 1500, durationActual: 900, startedAt: NOW - 20 * DAY, status: 'completed', tags: [] }
    ];
    const summary = buildWeekSummary(
      sessions,
      [
        submission({ status: 'accepted', submittedAt: NOW - DAY }),
        submission({ id: 's2', status: 'duplicate' }),
        submission({ id: 's3', status: 'triaged' })
      ],
      [{ id: 'p', program: 'Acme', platform: 'hackerone', severity: 'high', amount: 500, date: NOW - DAY, status: 'paid', createdAt: NOW, updatedAt: NOW }],
      NOW
    );
    expect(summary.huntSeconds).toBe(1200);
    expect(summary.sessions).toBe(1);
    expect(summary.submitted).toBe(1);
    expect(summary.inFlight).toBe(2);
    expect(summary.acceptanceRate).toBe(0.5);
    expect(summary.earnedThisYear).toBe(500);
  });

  it('reports no acceptance rate before any decision', () => {
    expect(buildWeekSummary([], [submission({ status: 'submitted' })], [], NOW).acceptanceRate).toBeNull();
  });
});

describe('buildRecentActivity', () => {
  it('merges entities newest first and respects the limit', () => {
    const activity = buildRecentActivity(
      {
        programs: [program],
        sessions: [
          { id: 'x', targetId: 'p1', durationPlanned: 1500, durationActual: 1500, startedAt: NOW - 3 * DAY, endedAt: NOW - 3 * DAY, status: 'completed', tags: [] }
        ],
        notes: [{ id: 'n', title: 'Recon', content: '', targetId: 'p1', tags: [], createdAt: NOW, updatedAt: NOW - DAY }],
        submissions: [submission({ timeline: [{ id: 't', status: 'triaged', at: NOW - 2 * DAY }] })],
        payouts: []
      },
      2
    );
    expect(activity.map((entry) => entry.kind)).toEqual(['note', 'finding']);
    expect(activity[1].detail).toContain('Triaged');
  });
});

describe('buildSetupSteps', () => {
  it('marks steps complete as the loop is exercised', () => {
    const steps = buildSetupSteps({ programs: [program], assets: [], sessions: [], submissions: [] });
    expect(steps.map((step) => step.done)).toEqual([true, false, false, false]);
  });
});
