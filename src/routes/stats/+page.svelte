<script lang="ts">
  import ActivityChart from '$lib/components/stats/ActivityChart.svelte';
  import InsightCard from '$lib/components/stats/InsightCard.svelte';
  import MetricCard from '$lib/components/workspace/MetricCard.svelte';
  import StreakCalendar from '$lib/components/stats/StreakCalendar.svelte';
  import TodaySummary from '$lib/components/stats/TodaySummary.svelte';
  import VulnTypeChart from '$lib/components/stats/VulnTypeChart.svelte';
  import { templateDB } from '$lib/db/templates';
  import {
    avgSessionLengthStore,
    bestStreakStore,
    dailyStatsStore,
    sessionStore,
    streakStore,
    targetStore,
    todayMinutesStore,
    userStatsStore
  } from '$lib/stores';
  import type { NoteTemplate, Session } from '$lib/types';
  import { BarChart3, Clock, Flame, Lightbulb, Target, Timer, Trophy } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let templates: NoteTemplate[] = [];

  function localDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function sessionDateKey(timestamp: number): string {
    return localDateKey(new Date(timestamp));
  }

  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  function templateName(id: string): string {
    if (id === 'uncategorized') return 'uncategorized work';
    return templates.find((template) => template.id === id)?.name ?? id;
  }

  function periodSeconds(sessions: Session[], days: number, offsetDays = 0): number {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    end.setDate(end.getDate() - offsetDays);
    const start = new Date(end);
    start.setDate(end.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);

    return sessions
      .filter((session) => session.status === 'completed' && session.startedAt >= start.getTime() && session.startedAt <= end.getTime())
      .reduce((sum, session) => sum + session.durationActual, 0);
  }

  function mostActiveWindow(byHour: Record<number, number>): string {
    const windows = [
      { label: 'Morning', hours: [6, 7, 8, 9, 10, 11] },
      { label: 'Afternoon', hours: [12, 13, 14, 15, 16, 17] },
      { label: 'Evening', hours: [18, 19, 20, 21, 22, 23] },
      { label: 'Night', hours: [0, 1, 2, 3, 4, 5] }
    ];
    const ranked = windows
      .map((window) => ({
        label: window.label,
        count: window.hours.reduce((sum, hour) => sum + (byHour[hour] ?? 0), 0)
      }))
      .sort((a, b) => b.count - a.count);
    // Without this guard the function used to claim "Morning" was the most
    // active window even when the user had zero completed sessions — every
    // bucket scored 0 and the array order won.
    if (!ranked[0] || ranked[0].count === 0) return 'No pattern';
    return ranked[0].label;
  }

  function daysSinceLastCompleted(sessions: Session[]): number | null {
    const latest = sessions.filter((session) => session.status === 'completed').sort((a, b) => b.startedAt - a.startedAt)[0];
    if (!latest) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const latestDay = new Date(latest.startedAt);
    latestDay.setHours(0, 0, 0, 0);
    return Math.floor((today.getTime() - latestDay.getTime()) / 86_400_000);
  }

  onMount(async () => {
    await Promise.all([sessionStore.load(), targetStore.load()]);
    templates = await templateDB.getAll();
  });

  $: todayKey = localDateKey(new Date());
  $: todaySessions = $sessionStore.filter(
    (session) => session.status === 'completed' && sessionDateKey(session.startedAt) === todayKey
  ).length;
  $: weekSeconds = periodSeconds($sessionStore, 7);
  $: previousWeekSeconds = periodSeconds($sessionStore, 7, 7);
  $: monthSeconds = periodSeconds($sessionStore, 30);
  $: activeTargets = $targetStore.filter((target) => target.status !== 'archived' && target.status !== 'closed').length;
  $: completedTargets = $targetStore.filter((target) => target.status === 'paid' || target.status === 'closed').length;
  $: archivedTargets = $targetStore.filter((target) => target.status === 'archived').length;
  $: mostActive = mostActiveWindow($userStatsStore.byHour);
  $: templateTime = $sessionStore
    .filter((session) => session.status === 'completed')
    .reduce<Record<string, number>>((groups, session) => {
      const key = session.templateId ?? 'uncategorized';
      groups[key] = (groups[key] ?? 0) + session.durationActual;
      return groups;
    }, {});
  $: topTemplate = Object.entries(templateTime).sort((a, b) => b[1] - a[1])[0];
  $: inactiveDays = daysSinceLastCompleted($sessionStore);
</script>

<svelte:head>
  <title>Stats | HuntFlow</title>
  <meta name="description" content="HuntFlow hunting stats, streak calendar, activity charts, and insights." />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner">
    <header class="hf-page-header">
      <div>
        <p class="hf-eyebrow">Stats Dashboard</p>
        <h1 class="hf-title">Hunting Stats</h1>
        <p class="hf-description">
          Stats are computed directly from completed sessions, with no separate stats table.
        </p>
      </div>
      <a
        href="/timer"
        class="hf-button-primary"
      >
        <Timer size={20} aria-hidden="true" />
        Start Session
      </a>
    </header>

    <TodaySummary
      todayMinutes={$todayMinutesStore}
      {todaySessions}
      streak={$streakStore}
      bestStreak={$bestStreakStore}
    />

    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard icon={Clock} label="Total hunting time" value={formatDuration($userStatsStore.totalTimeSeconds)} detail={`${formatDuration(monthSeconds)} this month`} href="/analytics" />
      <MetricCard icon={BarChart3} label="This week" value={formatDuration(weekSeconds)} detail={`${formatDuration(previousWeekSeconds)} prev`} href="/analytics" tone="info" />
      <MetricCard icon={Timer} label="Average session length" value={formatDuration($avgSessionLengthStore)} detail={`${$userStatsStore.completedSessions} completed`} href="/analytics" tone="warning" />
      <MetricCard icon={Target} label="Active targets" value={`${activeTargets}/${$targetStore.length}`} detail={`${completedTargets} completed, ${archivedTargets} archived`} href="/targets" />
    </section>

    <section class="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <StreakCalendar sessions={$sessionStore} targets={$targetStore} />
      <section class="space-y-4">
        <MetricCard icon={Flame} label="Current streak" value={`${$streakStore}d`} detail={`${$bestStreakStore}d best`} tone="warning" />
        <MetricCard icon={Trophy} label="Most active time" value={mostActive} detail="by completed sessions" />
      </section>
    </section>

    <section class="grid gap-4 lg:grid-cols-2">
      <ActivityChart dailyStats={$dailyStatsStore} />
      <VulnTypeChart byVulnType={$userStatsStore.byVulnType} {templates} />
    </section>

    <section>
      <h2 class="mb-4 text-lg font-semibold text-zinc-100">Insights</h2>
      <div class="grid gap-4 lg:grid-cols-3">
        {#if $streakStore > 2}
          <InsightCard icon={Flame} title={`${$streakStore} days in a row`} detail="Your current consistency is compounding. Keep one session per day on the board." tone="amber" />
        {:else if inactiveDays !== null && inactiveDays >= 2}
          <InsightCard icon={Flame} title="No hunting in 2 days" detail="A short completed session today is enough to restart the rhythm." tone="red" />
        {:else}
          <InsightCard icon={Flame} title="One session changes the day" detail="Complete a focused session today to keep the dashboard moving." tone="primary" />
        {/if}

        {#if topTemplate}
          <InsightCard icon={Lightbulb} title={`You've spent ${Math.max(1, Math.round(topTemplate[1] / 3600))} hours on ${templateName(topTemplate[0])}`} detail="That pattern can guide your next template, checklist, or report workflow." tone="blue" />
        {:else}
          <InsightCard icon={Lightbulb} title="Pick templates during sessions" detail="Template data unlocks vulnerability distribution and specialization insights." tone="blue" />
        {/if}

        <InsightCard
          icon={Timer}
          title={`Your average session is ${formatDuration($avgSessionLengthStore)}`}
          detail={$avgSessionLengthStore > 0 && $avgSessionLengthStore < 2700 ? 'Try a 45m block when you need deeper verification time.' : 'Your session length is ready for deeper analysis as history grows.'}
          tone="violet"
        />
      </div>
    </section>
  </div>
</main>
