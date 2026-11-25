<script lang="ts">
  import type { TimerState } from '$lib/types';
  import { Check, Pause, Play, RotateCcw, X } from 'lucide-svelte';
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

<!-- Capsule controls in the spirit of Apple's Clock app: neutral cancel on
     the left, tinted primary action on the right. -->
<div class="flex flex-wrap items-center justify-center gap-2.5">
  {#if status === 'idle'}
    <button
      type="button"
      disabled={!canStart}
      class="inline-flex h-11 items-center gap-2 rounded-full bg-green-500/[0.16] px-6 text-[0.9375rem] font-semibold text-green-400 transition hover:bg-green-500/[0.24] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
      on:click={() => dispatch('start')}
    >
      <Play size={15} fill="currentColor" aria-hidden="true" />
      Start Hunting
    </button>
  {:else if status === 'running' || status === 'paused'}
    <button
      type="button"
      class="inline-flex h-11 items-center gap-2 rounded-full px-5 text-[0.9375rem] font-medium text-zinc-200 transition active:scale-[0.97]"
      style="background: var(--hf-fill)"
      on:click={() => dispatch('abandon')}
    >
      <X size={15} aria-hidden="true" />
      Abandon
    </button>
    {#if status === 'running'}
      <button
        type="button"
        class="inline-flex h-11 items-center gap-2 rounded-full bg-orange-500/[0.16] px-5 text-[0.9375rem] font-semibold text-orange-400 transition hover:bg-orange-500/[0.24] active:scale-[0.97]"
        on:click={() => dispatch('pause')}
      >
        <Pause size={15} fill="currentColor" aria-hidden="true" />
        Pause
      </button>
    {:else}
      <button
        type="button"
        class="inline-flex h-11 items-center gap-2 rounded-full bg-green-500/[0.16] px-5 text-[0.9375rem] font-semibold text-green-400 transition hover:bg-green-500/[0.24] active:scale-[0.97]"
        on:click={() => dispatch('resume')}
      >
        <Play size={15} fill="currentColor" aria-hidden="true" />
        Resume
      </button>
    {/if}
    <button
      type="button"
      class="inline-flex h-11 items-center gap-2 rounded-full bg-primary/[0.14] px-5 text-[0.9375rem] font-semibold text-primary transition hover:bg-primary/[0.2] active:scale-[0.97]"
      on:click={() => dispatch('complete')}
    >
      <Check size={15} strokeWidth={2.6} aria-hidden="true" />
      Complete Early
    </button>
  {:else}
    <button
      type="button"
      class="inline-flex h-11 items-center gap-2 rounded-full px-6 text-[0.9375rem] font-medium text-zinc-200 transition active:scale-[0.97]"
      style="background: var(--hf-fill)"
      on:click={() => dispatch('reset')}
    >
      <RotateCcw size={15} aria-hidden="true" />
      Reset
    </button>
  {/if}
</div>
