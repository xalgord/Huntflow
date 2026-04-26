import type { Session } from '$lib/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  computeBestStreak,
  computeByHour,
  computeByVulnType,
  computeDailyStats,
  computeStreak
} from './stats';
import { formatDateKey } from './time';

const targetId = 'target-1';

function at(dayOffset: number, hour = 10): number {
  return new Date(2026, 3, 24 + dayOffset, hour, 0, 0, 0).getTime();
}

function session(overrides: Partial<Session>): Session {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    targetId,
    durationPlanned: 1_500,
    durationActual: 1_500,
    startedAt: at(0),
    endedAt: at(0, 10) + 1_500_000,
    status: 'completed',
    tags: [],
    ...overrides
  };
}

describe('stats utilities', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes the current streak from today backwards using completed sessions only', () => {
    vi.setSystemTime(at(0, 12));

    const sessions = [
      session({ startedAt: at(0), status: 'completed' }),
      session({ startedAt: at(-1), status: 'completed' }),
      session({ startedAt: at(-2), status: 'completed' }),
      session({ startedAt: at(-3), status: 'abandoned', durationActual: 100 }),
      session({ startedAt: at(-4), status: 'completed' })
    ];

    expect(computeStreak(sessions)).toBe(3);
  });

  it('returns zero current streak when today has no completed session', () => {
    vi.setSystemTime(at(0, 12));

    expect(computeStreak([session({ startedAt: at(-1) })])).toBe(0);
  });

  it('computes the best streak across all completed session days', () => {
    const sessions = [
      session({ startedAt: at(-9) }),
      session({ startedAt: at(-8) }),
      session({ startedAt: at(-6) }),
      session({ startedAt: at(-5) }),
      session({ startedAt: at(-4) }),
      session({ startedAt: at(-4, 16) }),
      session({ startedAt: at(-3), status: 'paused', durationActual: 300 })
    ];

    expect(computeBestStreak(sessions)).toBe(3);
  });

  it('returns zero best streak with no completed sessions', () => {
    expect(computeBestStreak([session({ status: 'running', durationActual: 0 })])).toBe(0);
  });

  it('computes daily stats for the requested trailing day window', () => {
    vi.setSystemTime(at(0, 12));

    const sessions = [
      session({ startedAt: at(-2), durationActual: 1_500 }),
      session({ startedAt: at(-1), status: 'abandoned', durationActual: 100 }),
      session({ startedAt: at(0), durationActual: 3_600 }),
      session({ startedAt: at(0, 18), durationActual: 90 }),
      session({ startedAt: at(-4), durationActual: 1_500 })
    ];

    expect(computeDailyStats(sessions, 3)).toEqual([
      {
        date: formatDateKey(at(-2)),
        totalMinutes: 25,
        sessionCount: 1,
        completedCount: 1
      },
      {
        date: formatDateKey(at(-1)),
        totalMinutes: 0,
        sessionCount: 1,
        completedCount: 0
      },
      {
        date: formatDateKey(at(0)),
        totalMinutes: 62,
        sessionCount: 2,
        completedCount: 2
      }
    ]);
  });

  it('returns an empty daily stat list when days is zero', () => {
    vi.setSystemTime(at(0, 12));

    expect(computeDailyStats([session({})], 0)).toEqual([]);
  });

  it('groups completed sessions by template id with uncategorized fallback', () => {
    const sessions = [
      session({ templateId: 'xss' }),
      session({ templateId: 'xss' }),
      session({ templateId: 'idor' }),
      session({}),
      session({ templateId: 'xss', status: 'abandoned', durationActual: 100 })
    ];

    expect(computeByVulnType(sessions)).toEqual({
      xss: 2,
      idor: 1,
      uncategorized: 1
    });
  });

  it('groups completed sessions by local start hour', () => {
    const sessions = [
      session({ startedAt: at(0, 9) }),
      session({ startedAt: at(0, 9) }),
      session({ startedAt: at(0, 15) }),
      session({ startedAt: at(0, 15), status: 'paused', durationActual: 300 })
    ];

    expect(computeByHour(sessions)).toEqual({
      9: 2,
      15: 1
    });
  });
});
