<script lang="ts">
  import type { TimerState } from '$lib/types';
  import { CheckCircle2, Pause, Play, RotateCcw, Square } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  export let status: TimerState['status'] = 'idle';
  export let canStart = false;

  const dispatch = createEventDispatcher<{
    start: void;
    pause: void;
    resume: void;
    abandon: void;
    complete: void;
    reset: void;
  }>();
</script>

<div class="flex flex-wrap items-center justify-center gap-3">
  {#if status === 'idle'}
    <button
      type="button"
      disabled={!canStart}
      class="hf-button-primary px-5 disabled:cursor-not-allowed"
      on:click={() => dispatch('start')}
    >
      <Play size={20} aria-hidden="true" />
      Start Hunting
    </button>
  {:else if status === 'running'}
    <button
      type="button"
      class="hf-button-secondary"
      on:click={() => dispatch('pause')}
    >
      <Pause size={20} aria-hidden="true" />
      Pause
    </button>
    <button
      type="button"
      class="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground shadow-dark-sm transition hover:bg-destructive/90 active:scale-[0.98]"
      on:click={() => dispatch('abandon')}
    >
      <Square size={20} aria-hidden="true" />
      Abandon
    </button>
    <button
      type="button"
      class="hf-button-primary"
      on:click={() => dispatch('complete')}
    >
      <CheckCircle2 size={20} aria-hidden="true" />
      Complete Early
    </button>
  {:else if status === 'paused'}
    <button
      type="button"
      class="hf-button-primary"
      on:click={() => dispatch('resume')}
    >
      <Play size={20} aria-hidden="true" />
      Resume
    </button>
    <button
      type="button"
      class="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground shadow-dark-sm transition hover:bg-destructive/90 active:scale-[0.98]"
      on:click={() => dispatch('abandon')}
    >
      <Square size={20} aria-hidden="true" />
      Abandon
    </button>
  {:else}
    <button
      type="button"
      class="hf-button-secondary"
      on:click={() => dispatch('reset')}
    >
      <RotateCcw size={20} aria-hidden="true" />
      Reset
    </button>
  {/if}
</div>
