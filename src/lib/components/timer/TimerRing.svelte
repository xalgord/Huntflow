<script lang="ts">
  import type { TimerState } from '$lib/types';

  export let remainingMs = 25 * 60 * 1000;
  export let totalMs = 25 * 60 * 1000;
  export let status: TimerState['status'] = 'idle';

  $: radius = 116;
  $: circumference = 2 * Math.PI * radius;
  $: progress = totalMs > 0 ? Math.min(Math.max(100 - (remainingMs / totalMs) * 100, 0), 100) : 0;
  $: dashOffset = circumference - (progress / 100) * circumference;
  $: totalSeconds = Math.max(Math.ceil(remainingMs / 1000), 0);
  $: minutes = Math.floor(totalSeconds / 60);
  $: seconds = totalSeconds % 60;
  $: time = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  $: stateColor =
    status === 'paused'
      ? 'text-amber-300'
      : status === 'completed'
        ? 'text-primary'
        : status === 'idle'
          ? 'text-muted-foreground'
          : 'text-foreground';
</script>

<div class="relative mx-auto h-[240px] w-[240px] sm:h-[280px] sm:w-[280px]">
  <svg class="h-full w-full -rotate-90" viewBox="0 0 280 280" aria-hidden="true">
    <circle
      class="text-muted"
      cx="140"
      cy="140"
      r={radius}
      fill="none"
      stroke="currentColor"
      stroke-width="8"
    />
    <circle
      class="text-primary drop-shadow-sm transition-[stroke-dashoffset] duration-1000 ease-linear"
      cx="140"
      cy="140"
      r={radius}
      fill="none"
      stroke="currentColor"
      stroke-width="8"
      stroke-linecap="round"
      stroke-dasharray={circumference}
      stroke-dashoffset={dashOffset}
    />
  </svg>

  <div class="absolute inset-0 flex flex-col items-center justify-center">
    <div class="font-mono text-5xl font-semibold tabular-nums tracking-normal {stateColor}">
      {time}
    </div>
    <div class="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {status}
    </div>
  </div>
</div>
