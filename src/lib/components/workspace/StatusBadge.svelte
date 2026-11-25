<script lang="ts">
  type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

  export let label: string;
  export let tone: Tone = 'neutral';

  // Tinted capsules in the style of Apple's status tags.
  const toneClass: Record<Tone, string> = {
    neutral: 'text-zinc-300',
    info: 'bg-blue-500/[0.14] text-blue-400',
    success: 'bg-green-500/[0.14] text-green-400',
    warning: 'bg-orange-500/[0.14] text-orange-400',
    danger: 'bg-red-500/[0.14] text-red-400'
  };
</script>

<span
  class="inline-flex h-[1.375rem] shrink-0 items-center whitespace-nowrap rounded-full px-2 text-[0.6875rem] font-semibold leading-none {toneClass[tone]}"
  style={tone === 'neutral' ? 'background: var(--hf-fill)' : ''}
>
  {label}
</span>
