<script lang="ts">
  import TargetForm from '$lib/components/targets/TargetForm.svelte';
  import EmptyState from '$lib/components/workspace/EmptyState.svelte';
  import MetricCard from '$lib/components/workspace/MetricCard.svelte';
  import StatusBadge from '$lib/components/workspace/StatusBadge.svelte';
  import { noteStore, reconAssetStore, sessionStore, submissionStore, targetStore } from '$lib/stores';
  import type { Platform, Priority, Target, TargetStatus } from '$lib/types';
  import {
    formatRelativeDate,
    platformLabels,
    priorityLabels,
    programUrlHost,
    statusTone,
    targetStatusLabels
  } from '$lib/utils/workspace';
  import { FileText, Filter, FolderKanban, Plus, Search, ShieldAlert, Target as TargetIcon } from 'lucide-svelte';
  import { onMount } from 'svelte';

  type StatusFilter = TargetStatus | 'all';
  type PriorityFilter = Priority | 'all';
  type PlatformFilter = Platform | 'all';

  let loaded = false;
  let showForm = false;
  let query = '';
  let platformFilter: PlatformFilter = 'all';
  let priorityFilter: PriorityFilter = 'all';
  let statusFilter: StatusFilter = 'all';

  const platformOptions: { value: Platform; label: string }[] = [
    { value: 'hackerone', label: 'HackerOne' },
    { value: 'bugcrowd', label: 'Bugcrowd' },
    { value: 'intigriti', label: 'Intigriti' },
    { value: 'yeswehack', label: 'YesWeHack' },
    { value: 'synack', label: 'Synack' },
    { value: 'self-hosted', label: 'Private' },
    { value: 'other', label: 'Other' }
  ];

  onMount(async () => {
    await Promise.all([
      targetStore.load(),
      reconAssetStore.load(),
      sessionStore.load(),
      noteStore.load(),
      submissionStore.load()
    ]);
    showForm = new URLSearchParams(location.search).get('new') === '1';
    loaded = true;
  });

  async function createProgram(event: CustomEvent<{ target: Target }>): Promise<void> {
    await targetStore.put(event.detail.target);
    await targetStore.persistNow();
    showForm = false;
  }

  function targetCount(programId: string): number {
    return $reconAssetStore.filter((asset) => asset.targetId === programId).length;
  }

  function findingCount(programId: string): number {
    return $submissionStore.filter((submission) => submission.targetId === programId).length;
  }

  $: activePrograms = $targetStore.filter((program) => !['archived', 'closed'].includes(program.status));
  $: highPriority = $targetStore.filter((program) => program.priority <= 1).length;
  $: privatePrograms = $targetStore.filter((program) => program.platform === 'self-hosted').length;
  $: filteredPrograms = $targetStore
    .filter((program) => {
      if (platformFilter !== 'all' && program.platform !== platformFilter) return false;
      if (priorityFilter !== 'all' && program.priority !== priorityFilter) return false;
      if (statusFilter !== 'all' && program.status !== statusFilter) return false;
      const search = query.trim().toLowerCase();
      if (!search) return true;
      return [program.name, program.programUrl ?? '', program.scope, program.notes, program.platform]
        .join(' ')
        .toLowerCase()
        .includes(search);
    })
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (b.lastSessionAt ?? b.updatedAt) - (a.lastSessionAt ?? a.updatedAt);
    });
</script>

<svelte:head>
  <title>Programs | HuntFlow bug bounty command center</title>
  <meta name="description" content="Track bug bounty programs, platforms, scope, priority, status, notes, and related targets." />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner">
    <header class="hf-page-header">
      <div>
        <p class="hf-eyebrow">Programs</p>
        <h1 class="hf-title">Bug bounty programs</h1>
        <p class="hf-description">
          Track HackerOne, Bugcrowd, Intigriti, private programs, policy links, scope notes, and hunting priority.
        </p>
      </div>
      <button type="button" class="hf-button-primary" on:click={() => (showForm = !showForm)}>
        <Plus size={17} aria-hidden="true" />
        Add Program
      </button>
    </header>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={FolderKanban} label="All programs" value={String($targetStore.length)} detail="Stored locally" />
      <MetricCard icon={TargetIcon} label="Active programs" value={String(activePrograms.length)} detail="Not archived or closed" />
      <MetricCard icon={Filter} label="High priority" value={String(highPriority)} detail="P0/P1 focus queue" />
      <MetricCard icon={ShieldAlert} label="Private programs" value={String(privatePrograms)} detail="Private/self-hosted entries" />
    </section>

    {#if showForm}
      <section class="hf-card p-5">
        <div class="mb-4">
          <h2 class="text-base font-semibold text-zinc-100">New program</h2>
          <p class="mt-1 text-sm text-zinc-500">Paste scope from a program page now or add it later in the detail view.</p>
        </div>
        <TargetForm submitLabel="Create Program" on:submit={createProgram} on:cancel={() => (showForm = false)} />
      </section>
    {/if}

    <section class="hf-card p-4">
      <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_160px_170px]">
        <label class="block">
          <span class="hf-label">Search</span>
          <div class="mt-2 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 focus-within:border-zinc-500 focus-within:ring-2 focus-within:ring-zinc-500/20">
            <Search size={16} class="text-zinc-600" aria-hidden="true" />
            <input bind:value={query} class="min-h-[44px] w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none" placeholder="Program, URL, scope, notes" />
          </div>
        </label>
        <label class="block">
          <span class="hf-label">Platform</span>
          <select bind:value={platformFilter} class="hf-select mt-2">
            <option value="all">All platforms</option>
            {#each platformOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label class="block">
          <span class="hf-label">Priority</span>
          <select bind:value={priorityFilter} class="hf-select mt-2">
            <option value="all">All priorities</option>
            <option value={0}>P0 Critical</option>
            <option value={1}>P1 High</option>
            <option value={2}>P2 Medium</option>
            <option value={3}>P3 Low</option>
          </select>
        </label>
        <label class="block">
          <span class="hf-label">Status</span>
          <select bind:value={statusFilter} class="hf-select mt-2">
            <option value="all">All statuses</option>
            <option value="recon">Watching</option>
            <option value="testing">Hunting</option>
            <option value="reported">Submitted</option>
            <option value="paid">Paid</option>
            <option value="closed">Paused</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>
    </section>

    {#if filteredPrograms.length > 0}
      <section class="hf-card overflow-hidden">
        <div class="hidden grid-cols-[minmax(220px,1.4fr)_130px_110px_110px_90px_90px_140px_80px] border-b border-zinc-800 px-4 py-3 text-xs font-medium text-zinc-500 lg:grid">
          <span>Program</span>
          <span>Platform</span>
          <span>Priority</span>
          <span>Status</span>
          <span>Targets</span>
          <span>Findings</span>
          <span>Last activity</span>
          <span class="text-right">Actions</span>
        </div>
        <div class="divide-y divide-zinc-900">
          {#each filteredPrograms as program}
            <a href={`/programs/${program.id}`} class="grid gap-3 px-4 py-4 transition hover:bg-zinc-950 lg:grid-cols-[minmax(220px,1.4fr)_130px_110px_110px_90px_90px_140px_80px] lg:items-center">
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium text-zinc-100">{program.name}</span>
                <span class="mt-1 block truncate font-mono text-xs text-zinc-500">{programUrlHost(program)}</span>
              </span>
              <span class="text-sm text-zinc-400">{platformLabels[program.platform]}</span>
              <span><StatusBadge label={priorityLabels[program.priority]} tone={program.priority <= 1 ? 'warning' : 'neutral'} /></span>
              <span><StatusBadge label={targetStatusLabels[program.status]} tone={statusTone(program.status)} /></span>
              <span class="font-mono text-sm text-zinc-300">{targetCount(program.id)}</span>
              <span class="font-mono text-sm text-zinc-300">{findingCount(program.id)}</span>
              <span class="text-xs text-zinc-500">{formatRelativeDate(program.lastSessionAt ?? program.updatedAt)}</span>
              <span class="text-right text-xs font-medium text-zinc-500">Open</span>
            </a>
          {/each}
        </div>
      </section>
    {:else if loaded}
      <EmptyState
        icon={FolderKanban}
        title={$targetStore.length === 0 ? 'No programs yet' : 'No programs match the filters'}
        description={$targetStore.length === 0
          ? 'Add your first HackerOne, Bugcrowd, Intigriti, or private program to start tracking scope and sessions.'
          : 'Adjust the filters or search query to widen the program list.'}
        actionLabel={$targetStore.length === 0 ? 'Add Program' : undefined}
        href={$targetStore.length === 0 ? '/programs?new=1' : undefined}
      />
    {/if}
  </div>
</main>
