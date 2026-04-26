<script lang="ts">
  import type { Priority } from '$lib/types';

  export let priority: Priority = 3;

  $: label = `P${priority}`;
  $: text =
    priority === 0
      ? 'Critical'
      : priority === 1
        ? 'High'
        : priority === 2
          ? 'Medium'
          : 'Low';
  $: classes =
    priority === 0
      ? 'border-red-500/30 bg-red-500/20 text-red-400 animate-priority-pulse'
      : priority === 1
        ? 'border-orange-500/30 bg-orange-500/20 text-orange-400'
        : priority === 2
          ? 'border-yellow-500/30 bg-yellow-500/20 text-yellow-400'
          : 'border-slate-500/30 bg-slate-700 text-slate-300';
</script>

<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium {classes}">
  {label} {text}
</span>
