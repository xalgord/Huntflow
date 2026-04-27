<script lang="ts">
  import type { Target } from '$lib/types';
  import { sessionStore, submissionStore } from '$lib/stores';
  import { CalendarClock, CheckCircle2, ChevronRight, DollarSign, Timer } from 'lucide-svelte';
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

  // ROI per program: $/hour focused and acceptance rate. Computed from
  // completed sessions (paused/abandoned excluded from focus time) and
  // status-decided submissions (drafts and pending triage excluded from
  // acceptance because they haven't been judged yet).
  $: focusedSeconds = $sessionStore
    .filter((s) => s.targetId === target.id && s.status === 'completed')
    .reduce((sum, s) => sum + (s.durationActual ?? 0), 0);
  $: focusedHours = focusedSeconds / 3600;

  $: targetSubmissions = $submissionStore.filter((s) => s.targetId === target.id);
  $: totalBounty = targetSubmissions.reduce((sum, s) => sum + (s.bountyAmount ?? 0), 0);

  $: decidedSubmissions = targetSubmissions.filter((s) =>
    ['accepted', 'rewarded', 'resolved', 'duplicate', 'informational', 'not-applicable', 'closed'].includes(s.status)
  );
  $: acceptedCount = targetSubmissions.filter((s) =>
    ['accepted', 'rewarded', 'resolved'].includes(s.status)
  ).length;
  $: acceptanceRate =
    decidedSubmissions.length > 0 ? Math.round((acceptedCount / decidedSubmissions.length) * 100) : null;

  $: dollarsPerHour = focusedHours >= 0.05 && totalBounty > 0 ? totalBounty / focusedHours : null;

  function formatHourly(value: number | null): string {
    if (value == null) return '—';
    if (value >= 1000) return `$${Math.round(value / 100) / 10}k/hr`;
    return `$${Math.round(value)}/hr`;
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

  {#if dollarsPerHour != null || acceptanceRate != null}
    <div class="mt-3 grid grid-cols-2 gap-3 border-t border-border/60 pt-3 text-sm">
      <div
        class="flex min-w-0 items-center gap-2"
        title={focusedHours > 0 ? `${focusedHours.toFixed(1)}h focused · $${totalBounty.toLocaleString()} earned` : 'No focused time logged'}
      >
        <DollarSign class="shrink-0 text-emerald-400" size={16} aria-hidden="true" />
        <span class="truncate font-medium {dollarsPerHour != null ? 'text-emerald-300' : 'text-muted-foreground'}">
          {formatHourly(dollarsPerHour)}
        </span>
      </div>
      <div
        class="flex items-center justify-end gap-2"
        title={decidedSubmissions.length > 0
          ? `${acceptedCount}/${decidedSubmissions.length} decided submissions accepted`
          : 'No decided submissions yet'}
      >
        <CheckCircle2 class="shrink-0 text-sky-400" size={16} aria-hidden="true" />
        <span class="font-medium {acceptanceRate != null ? 'text-sky-300' : 'text-muted-foreground'}">
          {acceptanceRate != null ? `${acceptanceRate}% accepted` : '—'}
        </span>
      </div>
    </div>
  {/if}
</a>
