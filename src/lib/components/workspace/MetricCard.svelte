<script lang="ts">
  import type { ComponentType } from 'svelte';
  import { ArrowRight, BarChart3 } from 'lucide-svelte';

  type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

  export let label: string;
  export let value: string;
  export let href: string | undefined = undefined;
  export let detail = '';
  export let icon: ComponentType = BarChart3;
  export let tone: Tone = 'neutral';

  const toneClass: Record<Tone, string> = {
    neutral: 'text-zinc-300',
    success: 'text-emerald-300',
    warning: 'text-amber-300',
    danger: 'text-red-300',
    info: 'text-blue-300'
  };
</script>

{#if href}
  <a href={href} class="hf-card hf-interactive group block p-4">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-xs font-medium text-zinc-500">{label}</p>
        <p class="mt-2 text-2xl font-semibold tracking-normal text-zinc-50">{value}</p>
      </div>
      <span class="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 {toneClass[tone]}">
        <svelte:component this={icon} size={17} aria-hidden="true" />
      </span>
    </div>
    {#if detail}
      <p class="mt-3 truncate text-xs text-zinc-500">{detail}</p>
    {/if}
    <span class="mt-4 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition group-hover:text-zinc-200">
      Open
      <ArrowRight size={13} aria-hidden="true" />
    </span>
  </a>
{:else}
  <article class="hf-card p-4">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-xs font-medium text-zinc-500">{label}</p>
        <p class="mt-2 text-2xl font-semibold tracking-normal text-zinc-50">{value}</p>
      </div>
      <span class="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 {toneClass[tone]}">
        <svelte:component this={icon} size={17} aria-hidden="true" />
      </span>
    </div>
    {#if detail}
      <p class="mt-3 truncate text-xs text-zinc-500">{detail}</p>
    {/if}
  </article>
{/if}
