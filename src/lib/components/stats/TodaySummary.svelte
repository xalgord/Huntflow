<script lang="ts">
  import { Flame, Play, Timer, Trophy } from 'lucide-svelte';

  export let todayMinutes = 0;
  export let todaySessions = 0;
  export let streak = 0;
  export let bestStreak = 0;

  function formatMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }
</script>

<section class="hf-card relative overflow-hidden p-5">
  <div class="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" aria-hidden="true"></div>
  <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
    <div>
      <p class="hf-eyebrow">Today</p>
      <h2 class="mt-2 text-3xl font-semibold tracking-normal text-foreground">{formatMinutes(todayMinutes)} hunted</h2>
      <p class="mt-2 text-sm text-muted-foreground">{todaySessions} completed sessions today</p>
    </div>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div class="hf-stat-tile">
        <Timer class="text-primary" size={20} aria-hidden="true" />
        <p class="mt-2 text-lg font-semibold text-foreground">{todaySessions}</p>
        <p class="text-xs text-muted-foreground">Sessions</p>
      </div>
      <div class="hf-stat-tile">
        <Flame class="text-amber-300" size={20} aria-hidden="true" />
        <p class="mt-2 text-lg font-semibold text-foreground">{streak}d</p>
        <p class="text-xs text-muted-foreground">Streak</p>
      </div>
      <div class="hf-stat-tile">
        <Trophy class="text-violet-300" size={20} aria-hidden="true" />
        <p class="mt-2 text-lg font-semibold text-foreground">{bestStreak}d</p>
        <p class="text-xs text-muted-foreground">Best</p>
      </div>
    </div>

    <a
      href="/timer"
      class="hf-button-primary"
    >
      <Play size={20} aria-hidden="true" />
      Start Session
    </a>
  </div>
</section>
