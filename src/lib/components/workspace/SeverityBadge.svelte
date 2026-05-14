<script lang="ts">
  import type { PayoutSeverity } from '$lib/types';
  import { severityLabels } from '$lib/utils/workspace';

  export let severity: PayoutSeverity;

  const classes: Record<PayoutSeverity, string> = {
    critical: 'border-red-500/40 bg-red-500/10 text-red-300',
    high: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
    medium: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200',
    low: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    informational: 'border-zinc-700 bg-zinc-900 text-zinc-300'
  };
</script>

<span
  class="inline-flex min-h-[24px] items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-none {classes[severity]}"
>
  {severityLabels[severity]}
</span>
