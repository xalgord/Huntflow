<script lang="ts">
  import type { ComponentType } from 'svelte';
  import { Lightbulb } from 'lucide-svelte';

  export let title: string;
  export let detail = '';
  export let icon: ComponentType = Lightbulb;
  export let tone: 'primary' | 'amber' | 'blue' | 'violet' | 'red' = 'primary';

  const toneClass = {
    primary: 'border-primary/25 bg-primary/10 text-primary',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    blue: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
    violet: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
    red: 'border-destructive/25 bg-destructive/10 text-red-300'
  };
</script>

<article class="hf-card p-4">
  <div class="flex gap-3">
    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border shadow-inner-line {toneClass[tone]}">
      <svelte:component this={icon} size={20} aria-hidden="true" />
    </div>
    <div>
      <h3 class="text-sm font-semibold text-foreground">{title}</h3>
      {#if detail}
        <p class="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p>
      {/if}
    </div>
  </div>
</article>
