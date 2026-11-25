<script lang="ts">
  import { evidenceAssetStore, noteStore, sessionStore, submissionStore } from '$lib/stores';
  import { buildActivity, dayLabel, groupByDay, type ActivityKind } from '$lib/utils/activity';
  import { ChevronRight, FileText, Paperclip, ShieldAlert, Timer } from 'lucide-svelte';
  import { onMount } from 'svelte';

  export let programId: string;

  onMount(() => {
    void Promise.all([sessionStore.load(), noteStore.load(), evidenceAssetStore.load(), submissionStore.load()]);
  });

  type Filter = ActivityKind | 'all';
  const filters: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'session', label: 'Sessions' },
    { id: 'note', label: 'Notes' },
    { id: 'evidence', label: 'Evidence' },
    { id: 'finding', label: 'Findings' }
  ];
  let filter: Filter = 'all';

  $: entries = buildActivity(programId, {
    sessions: $sessionStore,
    notes: $noteStore,
    evidence: $evidenceAssetStore,
    findings: $submissionStore
  });
  $: days = groupByDay(filter === 'all' ? entries : entries.filter((entry) => entry.kind === filter));

  const icons = { session: Timer, note: FileText, evidence: Paperclip, finding: ShieldAlert };
  const tints: Record<ActivityKind, string> = {
    session: 'bg-blue-500',
    note: 'bg-orange-500',
    evidence: 'bg-green-500',
    finding: 'bg-red-500'
  };
  const time = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
</script>

<section class="space-y-5" aria-label="Activity">
  <div class="hf-segmented w-full overflow-x-auto sm:w-auto" role="radiogroup" aria-label="Show">
    {#each filters as option}
      <button
        type="button"
        role="radio"
        aria-checked={filter === option.id}
        class="hf-segment {filter === option.id ? 'hf-segment-active' : ''}"
        on:click={() => (filter = option.id)}>{option.label}</button
      >
    {/each}
  </div>

  {#if days.length === 0}
    <p class="hf-card px-5 py-8 text-center text-[0.8125rem] text-zinc-500">
      Nothing here yet. Sessions, notes, evidence and findings for this program show up as you work.
    </p>
  {:else}
    {#each days as day (day.key)}
      <div>
        <h3 class="mb-2 px-1 text-[0.8125rem] font-semibold text-zinc-400">{dayLabel(day.at)}</h3>
        <ul class="hf-card hf-list overflow-hidden">
          {#each day.entries as entry (entry.id)}
            <li>
              <a href={entry.href} class="hf-list-row">
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-white {tints[entry.kind]}" aria-hidden="true">
                  <svelte:component this={icons[entry.kind]} size={15} strokeWidth={2.2} />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-medium text-zinc-100">{entry.title}</span>
                  <span class="block truncate text-xs text-zinc-500">{entry.detail}</span>
                </span>
                <span class="shrink-0 text-xs tabular-nums text-zinc-500">{time(entry.at)}</span>
                <ChevronRight size={15} class="shrink-0 text-zinc-600" aria-hidden="true" />
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  {/if}
</section>
