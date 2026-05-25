<script lang="ts">
  import { calculateSla, type SlaStatus } from '$lib/utils/submissionSla';
  import type { Submission } from '$lib/types';
  import { AlertCircle, CheckCircle2, Clock, FileText, Pause } from 'lucide-svelte';

  export let submission: Submission;

  $: status = calculateSla(submission);

  function classes(s: SlaStatus): string {
    switch (s.state) {
      case 'overdue':
        return 'border-red-500/40 bg-red-500/10 text-red-300';
      case 'approaching':
        return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
      case 'within':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
      case 'completed':
        return 'border-zinc-500/30 bg-zinc-700/30 text-zinc-300';
      case 'pending':
      default:
        return 'border-zinc-600/40 bg-zinc-800/40 text-zinc-400';
    }
  }

  function phaseLabel(phase: SlaStatus['phase']): string {
    if (phase === 'triage') return 'Triage';
    if (phase === 'resolution') return 'Resolution';
    return 'Reward';
  }
</script>

<span
  class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium {classes(status)}"
  title={status.message}
>
  {#if status.state === 'overdue'}
    <AlertCircle size={12} aria-hidden="true" />
  {:else if status.state === 'approaching'}
    <Clock size={12} aria-hidden="true" />
  {:else if status.state === 'within'}
    <Clock size={12} aria-hidden="true" />
  {:else if status.state === 'completed'}
    <CheckCircle2 size={12} aria-hidden="true" />
  {:else if status.state === 'pending'}
    <FileText size={12} aria-hidden="true" />
  {:else}
    <Pause size={12} aria-hidden="true" />
  {/if}
  <span>{phaseLabel(status.phase)}</span>
  {#if status.state === 'overdue'}
    <span aria-hidden="true">·</span>
    <span>{Math.abs(Math.round(status.daysRemaining ?? 0))}d late</span>
  {:else if status.state === 'approaching'}
    <span aria-hidden="true">·</span>
    <span>{Math.round(status.daysRemaining ?? 0)}d left</span>
  {:else if status.state === 'within' && status.daysRemaining != null}
    <span aria-hidden="true">·</span>
    <span>{Math.round(status.daysRemaining)}d left</span>
  {/if}
</span>
