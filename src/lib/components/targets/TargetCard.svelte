<script lang="ts">
  import type { Target } from '$lib/types';
  import { CalendarClock, ChevronRight, Timer } from 'lucide-svelte';
  import PlatformIcon from './PlatformIcon.svelte';
  import PriorityBadge from './PriorityBadge.svelte';
  import TargetStatusBadge from './TargetStatusBadge.svelte';

  export let target: Target;

  function formatDate(timestamp?: number): string {
    if (!timestamp) return 'No sessions';
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(timestamp));
  }
</script>

<a
  href={`/targets/${target.id}`}
  class="hf-card hf-interactive group block p-4 active:scale-[0.99]"
>
  <div class="flex items-start justify-between gap-4">
    <div class="min-w-0 space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="truncate text-lg font-semibold text-foreground">{target.name}</h2>
        <PriorityBadge priority={target.priority} />
      </div>
      <PlatformIcon platform={target.platform} />
    </div>
    <ChevronRight class="mt-1 shrink-0 text-muted-foreground transition group-hover:text-primary" size={20} />
  </div>

  <div class="mt-4 flex flex-wrap items-center gap-2">
    <TargetStatusBadge status={target.status} />
  </div>

  <div class="mt-4 grid grid-cols-2 gap-3 text-sm text-muted-foreground">
    <div class="flex min-w-0 items-center gap-2">
      <CalendarClock class="shrink-0 text-muted-foreground" size={16} aria-hidden="true" />
      <span class="truncate">{formatDate(target.lastSessionAt)}</span>
    </div>
    <div class="flex items-center justify-end gap-2">
      <Timer class="text-muted-foreground" size={16} aria-hidden="true" />
      <span>{target.sessionCount} sessions</span>
    </div>
  </div>
</a>
