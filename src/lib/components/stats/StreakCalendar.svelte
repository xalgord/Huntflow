<script lang="ts">
  import type { DailyStat, Session, Target } from '$lib/types';
  import { createEventDispatcher } from 'svelte';

  export let sessions: Session[] = [];
  export let targets: Target[] = [];

  const dispatch = createEventDispatcher<{ select: { date: string; sessions: Session[] } }>();
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let selectedDate = '';

  function localDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function sessionDateKey(session: Session): string {
    return localDateKey(new Date(session.startedAt));
  }

  function buildCalendar(): DailyStat[] {
    const byDate = new Map<string, DailyStat>();
    for (const session of sessions) {
      const key = sessionDateKey(session);
      const day = byDate.get(key) ?? { date: key, totalMinutes: 0, sessionCount: 0, completedCount: 0 };
      day.sessionCount += 1;
      if (session.status === 'completed') {
        day.completedCount += 1;
        day.totalMinutes += Math.round(session.durationActual / 60);
      }
      byDate.set(key, day);
    }
    const today = new Date();
    const cursor = new Date(today);
    const day = cursor.getDay();
    const mondayOffset = day === 0 ? 6 : day - 1;
    cursor.setDate(cursor.getDate() - mondayOffset - 77);

    return Array.from({ length: 84 }, (_, index) => {
      const date = new Date(cursor);
      date.setDate(cursor.getDate() + index);
      const key = localDateKey(date);
      return byDate.get(key) ?? { date: key, totalMinutes: 0, sessionCount: 0, completedCount: 0 };
    });
  }

  function intensity(minutes: number): string {
    if (minutes <= 0) return 'bg-zinc-800';
    if (minutes <= 15) return 'bg-primary-900/50';
    if (minutes <= 45) return 'bg-primary-800';
    if (minutes <= 90) return 'bg-primary-600';
    if (minutes <= 150) return 'bg-primary-400';
    return 'bg-primary-300';
  }

  function formatDay(date: string): string {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${date}T00:00:00`));
  }

  function targetName(id: string): string {
    return targets.find((target) => target.id === id)?.name ?? 'Unknown target';
  }

  function selectDay(date: string): void {
    selectedDate = date;
    const selectedSessions = sessions.filter((session) => sessionDateKey(session) === date);
    dispatch('select', { date, sessions: selectedSessions });
  }

  $: days = buildCalendar();
  $: selectedSessions = selectedDate ? sessions.filter((session) => sessionDateKey(session) === selectedDate) : [];
</script>

<section class="hf-card p-4">
  <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h2 class="text-lg font-semibold text-zinc-100">Streak Calendar</h2>
      <p class="mt-1 text-sm text-zinc-400">Last 12 weeks, colored by completed hunting minutes.</p>
    </div>
    <div class="flex items-center gap-2 text-xs text-zinc-500">
      <span>Less</span>
      <span class="h-3 w-3 rounded-sm bg-zinc-800"></span>
      <span class="h-3 w-3 rounded-sm bg-primary-900/50"></span>
      <span class="h-3 w-3 rounded-sm bg-primary-800"></span>
      <span class="h-3 w-3 rounded-sm bg-primary-600"></span>
      <span class="h-3 w-3 rounded-sm bg-primary-400"></span>
      <span class="h-3 w-3 rounded-sm bg-primary-300"></span>
      <span>More</span>
    </div>
  </div>

  <div class="overflow-x-auto pb-2">
    <div class="mb-2 grid w-fit grid-cols-7 gap-[3px] text-xs text-zinc-500">
      {#each weekdays as weekday}
        <span class="w-8 sm:w-10">{weekday}</span>
      {/each}
    </div>
    <div class="grid w-fit grid-cols-7 gap-[3px]">
      {#each days as day}
        <button
          type="button"
          class="h-3 w-8 min-h-0 rounded-sm transition hover:ring-2 hover:ring-primary-300 sm:h-4 sm:w-10 {intensity(
            day.totalMinutes
          )} {selectedDate === day.date ? 'ring-2 ring-white' : ''}"
          title={`${formatDay(day.date)}: ${day.totalMinutes} min, ${day.completedCount} completed`}
          aria-label={`${formatDay(day.date)}: ${day.totalMinutes} minutes`}
          on:click={() => selectDay(day.date)}
        ></button>
      {/each}
    </div>
  </div>

  {#if selectedDate}
    <div class="mt-4 rounded-lg border border-zinc-700 bg-zinc-900 p-3">
      <h3 class="text-sm font-semibold text-zinc-100">{formatDay(selectedDate)}</h3>
      {#if selectedSessions.length > 0}
        <div class="mt-3 divide-y divide-zinc-800">
          {#each selectedSessions as session}
            <div class="flex items-center justify-between gap-3 py-2 text-sm">
              <div>
                <p class="font-medium text-zinc-200">{targetName(session.targetId)}</p>
                <p class="text-xs text-zinc-500">{session.status}</p>
              </div>
              <span class="text-zinc-400">{Math.round(session.durationActual / 60)}m</span>
            </div>
          {/each}
        </div>
      {:else}
        <p class="mt-2 text-sm text-zinc-500">No sessions recorded for this day.</p>
      {/if}
    </div>
  {/if}
</section>
