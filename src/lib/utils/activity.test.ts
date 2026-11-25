import { describe, expect, it } from 'vitest';
import type { EvidenceAsset, Note, Session, Submission } from '$lib/types';
import { buildActivity, dayLabel, groupByDay } from './activity';

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 26, 15, 0).getTime();

describe('program activity', () => {
  const data = {
    sessions: [
      { id: 's1', targetId: 'p1', durationPlanned: 3600, durationActual: 5400, startedAt: NOW - DAY, status: 'completed', tags: [], quickNote: 'Mapped the API' },
      { id: 's2', targetId: 'p1', durationPlanned: 3600, durationActual: 0, startedAt: NOW - 1000, status: 'running', tags: [] },
      { id: 's3', targetId: 'p1', durationPlanned: 3600, durationActual: 60, startedAt: NOW - 2 * DAY, status: 'abandoned', tags: [] },
      { id: 's4', targetId: 'other', durationPlanned: 3600, durationActual: 60, startedAt: NOW, status: 'completed', tags: [] }
    ] as Session[],
    notes: [{ id: 'n1', targetId: 'p1', title: 'JWT notes', content: '', tags: ['auth', 'jwt'], createdAt: 0, updatedAt: NOW - 2 * DAY }] as unknown as Note[],
    evidence: [{ id: 'e1', targetId: 'p1', title: 'GET /orders', kind: 'http-exchange', createdAt: NOW - DAY + 10, updatedAt: 0 }] as unknown as EvidenceAsset[],
    findings: [
      { id: 'f1', targetId: 'p1', title: 'IDOR on orders', severity: 'high', status: 'submitted', submittedAt: NOW - 500, createdAt: NOW - DAY }
    ] as unknown as Submission[]
  };

  it('folds a program’s work into one newest-first feed', () => {
    const entries = buildActivity('p1', data);
    expect(entries.map((entry) => [entry.kind, entry.title, entry.detail])).toEqual([
      ['finding', 'IDOR on orders', 'Submitted · High'],
      ['session', 'Session in progress', 'Started'],
      ['evidence', 'GET /orders', 'Evidence · http exchange'],
      ['session', 'Hunted for 1h 30m', 'Mapped the API'],
      ['note', 'JWT notes', 'Note · #auth · #jwt']
    ]);
    expect(entries[0].href).toBe('/findings?id=f1');
  });

  it('groups by calendar day and labels recent days', () => {
    const days = groupByDay(buildActivity('p1', data));
    expect(days.map((day) => day.entries.length)).toEqual([2, 2, 1]);
    expect(dayLabel(days[0].at, NOW)).toBe('Today');
    expect(dayLabel(days[1].at, NOW)).toBe('Yesterday');
    expect(dayLabel(days[2].at, NOW)).not.toMatch(/Today|Yesterday/);
  });
});
