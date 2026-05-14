<script lang="ts">
  type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

  export let label: string;
  export let tone: Tone = 'neutral';

  const toneClass: Record<Tone, string> = {
    neutral: 'border-zinc-700 bg-zinc-900 text-zinc-300',
    info: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    danger: 'border-red-500/30 bg-red-500/10 text-red-300'
  };
</script>

<span
  class="inline-flex min-h-[24px] items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-none {toneClass[tone]}"
>
  {label}
</span>
