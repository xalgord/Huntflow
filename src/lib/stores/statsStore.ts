import type { DailyStat, Session, UserStats } from '$lib/types';
import { derived } from 'svelte/store';
import { sessionStore } from './sessionStore';

function completedSessions(sessions: Session[]): Session[] {
  return sessions.filter((session) => session.status === 'completed');
}

function dateKey(timestamp: number): string {
  return localDateKey(new Date(timestamp));
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function completedDates(sessions: Session[]): Set<string> {
  return new Set(completedSessions(sessions).map((session) => dateKey(session.startedAt)));
}

function computeCurrentStreak(sessions: Session[]): number {
  const activeDates = completedDates(sessions);
  let streak = 0;
  const cursor = new Date();

  while (activeDates.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function computeBestStreak(sessions: Session[]): number {
  const dates = Array.from(completedDates(sessions)).sort();
  if (dates.length === 0) return 0;

  let best = 1;
  let current = 1;

  for (let index = 1; index < dates.length; index += 1) {
    const previous = new Date(`${dates[index - 1]}T00:00:00.000Z`);
    const next = new Date(`${dates[index]}T00:00:00.000Z`);
    const diffDays = Math.round((next.getTime() - previous.getTime()) / 86_400_000);

    if (diffDays === 1) {
      current += 1;
    } else {
      current = 1;
    }

    best = Math.max(best, current);
  }

  return best;
}

function computeDailyStats(sessions: Session[]): DailyStat[] {
  const stats = new Map<string, DailyStat>();
  const today = new Date();

  for (let offset = 29; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = localDateKey(date);
    stats.set(key, {
      date: key,
      totalMinutes: 0,
      sessionCount: 0,
      completedCount: 0
    });
  }

  for (const session of sessions) {
    const key = dateKey(session.startedAt);
    const day = stats.get(key);
    if (!day) continue;

    day.sessionCount += 1;
    if (session.status === 'completed') {
      day.completedCount += 1;
      day.totalMinutes += Math.round((session.durationActual ?? 0) / 60);
    }
  }

  return Array.from(stats.values());
}

export const completedSessionsStore = derived(sessionStore, ($sessions) => completedSessions($sessions));

export const streakStore = derived(sessionStore, ($sessions) => computeCurrentStreak($sessions));

export const bestStreakStore = derived(sessionStore, ($sessions) => computeBestStreak($sessions));

export const todayMinutesStore = derived(sessionStore, ($sessions) => {
  const today = localDateKey(new Date());
  return completedSessions($sessions)
    .filter((session) => dateKey(session.startedAt) === today)
    .reduce((sum, session) => sum + Math.round((session.durationActual ?? 0) / 60), 0);
});

export const totalTimeStore = derived(sessionStore, ($sessions) =>
  completedSessions($sessions).reduce((sum, session) => sum + (session.durationActual ?? 0), 0)
);

export const avgSessionLengthStore = derived(sessionStore, ($sessions) => {
  const completed = completedSessions($sessions);
  if (completed.length === 0) return 0;
  return Math.round(completed.reduce((sum, session) => sum + (session.durationActual ?? 0), 0) / completed.length);
});

export const byVulnTypeStore = derived(sessionStore, ($sessions) =>
  completedSessions($sessions).reduce<Record<string, number>>((groups, session) => {
    const key = session.templateId ?? 'uncategorized';
    groups[key] = (groups[key] ?? 0) + 1;
    return groups;
  }, {})
);

export const dailyStatsStore = derived(sessionStore, ($sessions) => computeDailyStats($sessions));

export const userStatsStore = derived(
  [
    sessionStore,
    streakStore,
    bestStreakStore,
    totalTimeStore,
    avgSessionLengthStore,
    byVulnTypeStore,
    dailyStatsStore
  ],
  ([
    $sessions,
    $streak,
    $bestStreak,
    $totalTime,
    $avgSessionLength,
    $byVulnType,
    $dailyStats
  ]): UserStats => {
    const completed = completedSessions($sessions);
    return {
      totalTimeSeconds: $totalTime,
      totalSessions: $sessions.length,
      completedSessions: completed.length,
      abandonedSessions: $sessions.filter((session) => session.status === 'abandoned').length,
      avgSessionLength: $avgSessionLength,
      streak: $streak,
      bestStreak: $bestStreak,
      byVulnType: $byVulnType,
      byTarget: completed.reduce<Record<string, { count: number; time: number }>>((groups, session) => {
        const group = groups[session.targetId] ?? { count: 0, time: 0 };
        group.count += 1;
        group.time += session.durationActual ?? 0;
        groups[session.targetId] = group;
        return groups;
      }, {}),
      byHour: completed.reduce<Record<number, number>>((groups, session) => {
        const hour = new Date(session.startedAt).getHours();
        groups[hour] = (groups[hour] ?? 0) + 1;
        return groups;
      }, {}),
      dailyStats: $dailyStats
    };
  }
);
