<script lang="ts">
  import type { ComponentType } from 'svelte';
  import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-svelte';

  export let icon: ComponentType;
  export let value: string | number;
  export let label: string;
  export let trend = '';
  export let trendDirection: 'up' | 'down' | 'flat' = 'flat';
  export let tone: 'primary' | 'blue' | 'amber' | 'violet' | 'red' = 'primary';

  const toneClass = {
    primary: 'bg-primary/10 text-primary border-primary/25',
    blue: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    violet: 'bg-violet-500/10 text-violet-300 border-violet-500/25',
    red: 'bg-destructive/10 text-red-300 border-destructive/25'
  };
</script>

<article class="hf-card hf-interactive p-4">
  <div class="flex items-start justify-between gap-4">
    <div class="rounded-lg border p-2 shadow-inner-line {toneClass[tone]}">
      <svelte:component this={icon} size={24} aria-hidden="true" />
    </div>
    {#if trend}
      <span
        class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium {trendDirection === 'up'
          ? 'bg-primary-500/10 text-primary-300'
          : trendDirection === 'down'
            ? 'bg-red-500/10 text-red-300'
            : 'bg-muted text-muted-foreground'}"
      >
        {#if trendDirection === 'up'}
          <ArrowUpRight size={14} aria-hidden="true" />
        {:else if trendDirection === 'down'}
          <ArrowDownRight size={14} aria-hidden="true" />
        {:else}
          <ArrowRight size={14} aria-hidden="true" />
        {/if}
        {trend}
      </span>
    {/if}
  </div>

  <p class="mt-4 text-2xl font-semibold leading-tight tracking-normal text-foreground">{value}</p>
  <p class="mt-1 text-sm text-muted-foreground">{label}</p>
</article>
