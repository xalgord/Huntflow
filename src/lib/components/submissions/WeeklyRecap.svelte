<script lang="ts">
  import type { Session, Submission } from '$lib/types';
  import { buildWeeklyRecap } from '$lib/utils/submissionSla';
  import {
    Award,
    CalendarDays,
    Clock,
    DollarSign,
    Send,
    TrendingDown,
    TrendingUp
  } from 'lucide-svelte';

  export let submissions: Submission[];
  export let sessions: Session[];

  $: recap = buildWeeklyRecap(submissions, sessions);

  function money(value: number): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  }

  function formatHours(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
  }

  function deltaTone(value: number): string {
    if (value > 0) return 'text-emerald-300';
    if (value < 0) return 'text-red-300';
    return 'text-zinc-400';
  }

  function formatRange(start: number): string {
    const end = new Date(start + 6 * 24 * 60 * 60 * 1000);
    const startDate = new Date(start);
    const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
    return `${fmt.format(startDate)} – ${fmt.format(end)}`;
  }

  $: tiles = [
    {
      icon: Send,
      label: 'Submitted',
      value: String(recap.submitted),
      delta: recap.delta.submitted,
      deltaLabel: (v: number) => `${v >= 0 ? '+' : ''}${v} vs last week`
    },
    {
      icon: Award,
      label: 'Triaged',
      value: String(recap.triaged),
      delta: 0,
      deltaLabel: () => 'this week'
    },
    {
      icon: DollarSign,
      label: 'Bounty earned',
      value: money(recap.bountyEarned),
      delta: recap.delta.bountyEarned,
      deltaLabel: (v: number) =>
        v === 0 ? 'no change' : `${v > 0 ? '+' : '-'}${money(Math.abs(v))} vs last week`
    },
    {
      icon: Clock,
      label: 'Hours hunted',
      value: formatHours(recap.minutesHunted),
      delta: recap.delta.minutesHunted,
      deltaLabel: (v: number) =>
        v === 0 ? 'no change' : `${v > 0 ? '+' : '-'}${formatHours(Math.abs(v))} vs last week`
    }
  ];
</script>

<section class="hf-card p-4">
  <header class="flex flex-wrap items-center justify-between gap-2">
    <div>
      <p class="hf-eyebrow">This week</p>
      <h2 class="text-base font-semibold text-foreground">Weekly Recap</h2>
    </div>
    <span class="hf-pill">
      <CalendarDays size={12} aria-hidden="true" />
      {formatRange(recap.weekStart)}
    </span>
  </header>

  <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    {#each tiles as tile}
      {@const Icon = tile.icon}
      <div class="hf-stat-tile">
        <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Icon size={14} aria-hidden="true" />
          {tile.label}
        </div>
        <p class="mt-2 font-mono text-xl font-semibold text-foreground">{tile.value}</p>
        <p class="mt-1 inline-flex items-center gap-1 text-[11px] {deltaTone(tile.delta)}">
          {#if tile.delta > 0}
            <TrendingUp size={10} aria-hidden="true" />
          {:else if tile.delta < 0}
            <TrendingDown size={10} aria-hidden="true" />
          {/if}
          {tile.deltaLabel(tile.delta)}
        </p>
      </div>
    {/each}
  </div>

  {#if recap.sessionsCompleted > 0}
    <p class="mt-3 text-xs text-muted-foreground">
      {recap.sessionsCompleted} session{recap.sessionsCompleted === 1 ? '' : 's'} completed.
      {#if recap.minutesHunted > 0}
        Average pace: {formatHours(Math.round(recap.minutesHunted / recap.sessionsCompleted))} per session.
      {/if}
    </p>
  {:else}
    <p class="mt-3 text-xs text-muted-foreground">
      No sessions completed yet this week. Open the timer to log focused hunting time.
    </p>
  {/if}
</section>
