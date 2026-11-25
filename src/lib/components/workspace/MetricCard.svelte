<script lang="ts">
  import type { ComponentType } from 'svelte';
  import { BarChart3, ChevronRight } from 'lucide-svelte';

  type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

  export let label: string;
  export let value: string;
  export let href: string | undefined = undefined;
  export let detail = '';
  export let icon: ComponentType = BarChart3;
  export let tone: Tone = 'neutral';

  // Apple widget style: a tinted SF-symbol-like glyph, a small label and a
  // large rounded numeral.
  const toneClass: Record<Tone, string> = {
    neutral: 'text-primary',
    success: 'text-green-500',
    warning: 'text-orange-500',
    danger: 'text-red-500',
    info: 'text-blue-500'
  };
</script>

<svelte:element
  this={href ? 'a' : 'article'}
  href={href}
  class="hf-card group block px-4 py-3.5 {href ? 'hf-interactive' : ''}"
>
  <div class="flex items-center gap-1.5">
    <svelte:component this={icon} size={14} strokeWidth={2.3} class="shrink-0 {toneClass[tone]}" aria-hidden="true" />
    <p class="min-w-0 flex-1 truncate text-[0.75rem] font-semibold text-zinc-500">{label}</p>
    {#if href}
      <ChevronRight
        size={14}
        class="shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-400"
        aria-hidden="true"
      />
    {/if}
  </div>
  <p class="mt-1.5 text-[1.625rem] font-semibold leading-8 tracking-[-0.02em] tabular-nums text-zinc-50">{value}</p>
  {#if detail}
    <p class="mt-0.5 truncate text-[0.75rem] text-zinc-500">{detail}</p>
  {/if}
</svelte:element>
