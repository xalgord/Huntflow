<script lang="ts">
  import type { PayoutSeverity } from '$lib/types';
  import { severityLabels } from '$lib/utils/workspace';

  export let severity: PayoutSeverity;
  /** `dot` renders a compact coloured dot + label for dense tables. */
  export let variant: 'capsule' | 'dot' = 'capsule';

  const capsule: Record<PayoutSeverity, string> = {
    critical: 'bg-red-500 text-white',
    high: 'bg-orange-500/[0.16] text-orange-400',
    medium: 'bg-yellow-500/[0.18] text-yellow-400',
    low: 'bg-blue-500/[0.14] text-blue-400',
    informational: 'text-zinc-400'
  };

  const dot: Record<PayoutSeverity, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-blue-500',
    informational: 'bg-zinc-500'
  };
</script>

{#if variant === 'dot'}
  <span class="inline-flex items-center gap-1.5 whitespace-nowrap text-[0.75rem] font-medium text-zinc-200">
    <span class="h-2 w-2 shrink-0 rounded-full {dot[severity]}" aria-hidden="true"></span>
    {severityLabels[severity]}
  </span>
{:else}
  <span
    class="inline-flex h-[1.375rem] w-fit shrink-0 items-center whitespace-nowrap rounded-full px-2 text-[0.6875rem] font-semibold leading-none {capsule[severity]}"
    style={severity === 'informational' ? 'background: var(--hf-fill)' : ''}
  >
    {severityLabels[severity]}
  </span>
{/if}
