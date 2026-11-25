<script lang="ts">
  import type { TimerState } from '$lib/types';

  export let remainingMs = 25 * 60 * 1000;
  export let totalMs = 25 * 60 * 1000;
  export let status: TimerState['status'] = 'idle';

  const radius = 128;
  const circumference = 2 * Math.PI * radius;

  $: remainingFraction = totalMs > 0 ? Math.min(Math.max(remainingMs / totalMs, 0), 1) : 1;
  // Like Apple's Clock timer, the ring drains as time passes.
  $: dashOffset = circumference * (1 - remainingFraction);
  $: totalSeconds = Math.max(Math.ceil(remainingMs / 1000), 0);
  $: hours = Math.floor(totalSeconds / 3600);
  $: minutes = Math.floor((totalSeconds % 3600) / 60);
  $: seconds = totalSeconds % 60;
  $: time =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  $: label = status === 'running' ? 'Hunting' : status === 'paused' ? 'Paused' : status === 'completed' ? 'Done' : 'Ready';
  $: ringClass = status === 'paused' ? 'text-orange-500' : status === 'completed' ? 'text-green-500' : 'text-primary';
</script>

<div class="relative mx-auto aspect-square w-full max-w-[17.5rem]" role="timer" aria-label={`${label}, ${time} remaining`}>
  <svg class="h-full w-full -rotate-90" viewBox="0 0 280 280" aria-hidden="true">
    <circle cx="140" cy="140" r={radius} fill="none" stroke="var(--hf-fill)" stroke-width="7" />
    <circle
      class="{ringClass} transition-[stroke-dashoffset] duration-1000 ease-linear"
      cx="140"
      cy="140"
      r={radius}
      fill="none"
      stroke="currentColor"
      stroke-width="7"
      stroke-linecap="round"
      stroke-dasharray={circumference}
      stroke-dashoffset={dashOffset}
    />
  </svg>
  <div class="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
    <div
      class="text-[3.75rem] font-light leading-none tracking-[-0.03em] tabular-nums sm:text-[4.25rem] {status === 'idle'
        ? 'text-zinc-400'
        : 'text-zinc-50'}"
    >
      {time}
    </div>
    <div class="mt-2 text-[0.8125rem] font-medium text-zinc-500">{label}</div>
  </div>
</div>
