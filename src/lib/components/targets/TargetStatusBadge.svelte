<script lang="ts">
  import type { TargetStatus } from '$lib/types';

  export let status: TargetStatus = 'recon';

  const labels: Record<TargetStatus, string> = {
    recon: 'Recon',
    testing: 'Testing',
    reported: 'Reported',
    paid: 'Paid',
    closed: 'Closed',
    archived: 'Archived'
  };

  $: classes =
    status === 'recon'
      ? 'border-blue-500/30 bg-blue-500/20 text-blue-400'
      : status === 'testing'
        ? 'border-amber-500/30 bg-amber-500/20 text-amber-400'
        : status === 'reported'
          ? 'border-violet-500/30 bg-violet-500/20 text-violet-400'
          : status === 'paid'
            ? 'border-green-500/30 bg-green-500/20 text-green-400'
            : status === 'closed'
              ? 'border-slate-500/30 bg-slate-700 text-slate-300'
              : 'border-slate-600/40 bg-slate-800 text-slate-400';
</script>

<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium {classes}">
  {labels[status]}
</span>
