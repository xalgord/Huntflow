import type { DailyStat, Session } from '$lib/types';
import { formatDateKey, getStartOfDay } from './time';

function completedSessions(sessions: Session[]): Session[] {
  return sessions.filter((session) => session.status === 'completed');
}

function addLocalDays(timestamp: number, days: number): number {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return getStartOfDay(date.getTime());
}

function completedDayStarts(sessions: Session[]): number[] {
  return Array.from(new Set(completedSessions(sessions).map((session) => getStartOfDay(session.startedAt)))).sort(
    (left, right) => left - right
  );
}

export function computeStreak(sessions: Session[]): number {
  const activeDays = new Set(completedDayStarts(sessions));
  let cursor = getStartOfDay(Date.now());
  let streak = 0;

  while (activeDays.has(cursor)) {
    streak += 1;
    cursor = addLocalDays(cursor, -1);
  }

  return streak;
}

export function computeBestStreak(sessions: Session[]): number {
  const days = completedDayStarts(sessions);
  if (days.length === 0) return 0;

  let best = 1;
  let current = 1;

  for (let index = 1; index < days.length; index += 1) {
    if (addLocalDays(days[index - 1], 1) === days[index]) {
      current += 1;
    } else {
      current = 1;
    }

    best = Math.max(best, current);
  }

  return best;
}

export function computeDailyStats(sessions: Session[], days: number): DailyStat[] {
  const range = Math.max(0, Math.floor(days));
  const stats = new Map<number, DailyStat>();
  const today = getStartOfDay(Date.now());

  for (let offset = range - 1; offset >= 0; offset -= 1) {
    const timestamp = addLocalDays(today, -offset);
    stats.set(timestamp, {
      date: formatDateKey(timestamp),
      totalMinutes: 0,
      sessionCount: 0,
      completedCount: 0
    });
  }

  for (const session of sessions) {
    const dayStart = getStartOfDay(session.startedAt);
    const stat = stats.get(dayStart);
    if (!stat) continue;

    stat.sessionCount += 1;

    if (session.status === 'completed') {
      stat.completedCount += 1;
      stat.totalMinutes += Math.round(session.durationActual / 60);
    }
  }

  return Array.from(stats.values());
}

export function computeByVulnType(sessions: Session[]): Record<string, number> {
  return completedSessions(sessions).reduce<Record<string, number>>((groups, session) => {
    const type = session.templateId ?? 'uncategorized';
    groups[type] = (groups[type] ?? 0) + 1;
    return groups;
  }, {});
}

export function computeByHour(sessions: Session[]): Record<number, number> {
  return completedSessions(sessions).reduce<Record<number, number>>((groups, session) => {
    const hour = new Date(session.startedAt).getHours();
    groups[hour] = (groups[hour] ?? 0) + 1;
    return groups;
  }, {});
}
