<script lang="ts">
  import { afterNavigate, goto } from '$app/navigation';
  import FindingEditor from '$lib/components/findings/FindingEditor.svelte';
  import SlaIndicator from '$lib/components/submissions/SlaIndicator.svelte';
  import EmptyState from '$lib/components/workspace/EmptyState.svelte';
  import {
    evidenceAssetStore,
    noteStore,
    payoutStore,
    reconAssetStore,
    submissionStore,
    targetStore
  } from '$lib/stores';
  import type { EvidenceAsset, PayoutSeverity, Submission } from '$lib/types';
  import { findingFieldsFromNote } from '$lib/utils/findingReport';
  import { createFinding, findingBucket, STATUS_LABELS, type FindingBucket } from '$lib/utils/findingWorkflow';
  import { calculateSla } from '$lib/utils/submissionSla';
  import { formatRelativeDate } from '$lib/utils/workspace';
  import { Plus, Search, ShieldAlert } from 'lucide-svelte';
  import { onMount, tick } from 'svelte';

  type BucketFilter = FindingBucket | 'all';

  const buckets: Array<{ id: BucketFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'drafts', label: 'Drafts' },
    { id: 'open', label: 'Open' },
    { id: 'closed', label: 'Closed' }
  ];

  const severityDot: Record<PayoutSeverity, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-blue-500',
    informational: 'bg-zinc-500'
  };

  const severityRank: Record<PayoutSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 };

  let loaded = false;
  let selectedId = '';
  let query = '';
  let bucket: BucketFilter = 'all';
  let programFilter = 'all';
  let sort: 'recent' | 'severity' = 'recent';
  let mobileDetail = false;

  onMount(async () => {
    await Promise.all([
      submissionStore.load(),
      targetStore.load(),
      noteStore.load(),
      reconAssetStore.load(),
      evidenceAssetStore.load(),
      payoutStore.load()
    ]);
    programFilter = new URLSearchParams(location.search).get('target') ?? 'all';
    await handleParams(new URLSearchParams(location.search));
    loaded = true;
  });

  // Links into this page while it's already open (the + menu, the command
  // palette, "possible duplicate" links) are client-side navigations that
  // don't remount it, so react to them here.
  afterNavigate(({ type }) => {
    if (!loaded || type === 'enter') return;
    void handleParams(new URLSearchParams(location.search));
  });

  async function handleParams(params: URLSearchParams): Promise<void> {
    const fromNote = params.get('fromNote');
    if (fromNote) {
      await promoteNote(fromNote);
    } else if (params.get('new') === '1') {
      await createNew(params.get('target') ?? undefined, params.get('asset') ?? undefined);
    } else if (params.has('id')) {
      select(params.get('id') ?? '', false);
    }
  }

  function setUrl(id: string): void {
    const url = new URL(location.href);
    for (const key of ['new', 'fromNote', 'asset']) url.searchParams.delete(key);
    if (id) url.searchParams.set('id', id);
    else url.searchParams.delete('id');
    history.replaceState(history.state, '', url);
  }

  function select(id: string, updateUrl = true): void {
    selectedId = id;
    mobileDetail = Boolean(id);
    if (updateUrl) setUrl(id);
  }

  async function save(finding: Submission): Promise<void> {
    await submissionStore.put(finding);
  }

  async function createNew(targetId?: string, asset?: string): Promise<void> {
    const program = $targetStore.find((item) => item.id === targetId) ?? $targetStore[0];
    if (!program) {
      await goto('/programs?new=1');
      return;
    }
    const finding = createFinding(program, asset ? { affectedAssets: [asset] } : {});
    await save(finding);
    await submissionStore.persistNow();
    bucket = 'all';
    query = '';
    select(finding.id);
    await tick();
    document.getElementById('finding-title')?.focus();
  }

  async function promoteNote(noteId: string): Promise<void> {
    const existing = $submissionStore.find((finding) => finding.noteId === noteId);
    if (existing) {
      select(existing.id);
      return;
    }
    const note = $noteStore.find((item) => item.id === noteId);
    if (!note) {
      select('');
      return;
    }
    const program = $targetStore.find((item) => item.id === note.targetId) ?? $targetStore[0];
    const fields = findingFieldsFromNote(note);
    const finding = createFinding(program, Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)));
    await save(finding);
    await submissionStore.persistNow();
    select(finding.id);
  }

  async function remove(finding: Submission): Promise<void> {
    if (!confirm(`Delete “${finding.title || 'Untitled finding'}”? This can’t be undone.`)) return;
    await submissionStore.delete(finding.id);
    await submissionStore.persistNow();
    select('');
  }

  async function createEvidence(asset: EvidenceAsset): Promise<void> {
    await evidenceAssetStore.put(asset);
  }

  $: programsById = new Map($targetStore.map((program) => [program.id, program]));
  $: counts = {
    all: $submissionStore.length,
    drafts: $submissionStore.filter((finding) => findingBucket(finding.status) === 'drafts').length,
    open: $submissionStore.filter((finding) => findingBucket(finding.status) === 'open').length,
    closed: $submissionStore.filter((finding) => findingBucket(finding.status) === 'closed').length
  };
  $: filtered = $submissionStore
    .filter((finding) => {
      if (bucket !== 'all' && findingBucket(finding.status) !== bucket) return false;
      if (programFilter !== 'all' && finding.targetId !== programFilter) return false;
      const search = query.trim().toLowerCase();
      if (!search) return true;
      return [
        finding.title,
        finding.vulnerabilityType ?? '',
        finding.cweId ?? '',
        (finding.affectedAssets ?? []).join(' '),
        finding.summary ?? '',
        finding.reportMarkdown ?? '',
        programsById.get(finding.targetId)?.name ?? ''
      ]
        .join(' ')
        .toLowerCase()
        .includes(search);
    })
    .sort((a, b) =>
      sort === 'severity'
        ? severityRank[a.severity] - severityRank[b.severity] || b.updatedAt - a.updatedAt
        : b.updatedAt - a.updatedAt
    );
  $: selected = $submissionStore.find((finding) => finding.id === selectedId);
</script>

<svelte:head>
  <title>{selected?.title ? `${selected.title} · ` : ''}Findings | HuntFlow</title>
  <meta
    name="description"
    content="Write findings once and export platform-ready reports for HackerOne, Bugcrowd, Intigriti and YesWeHack, with CVSS 3.1/4.0, CWE, templates and duplicate checks."
  />
</svelte:head>

<main class="hf-page !pb-0 lg:!px-0 lg:!pt-0">
  <div class="mx-auto grid max-w-[1800px] lg:h-[calc(100vh-3.25rem)] lg:grid-cols-[22rem_minmax(0,1fr)]">
    <!-- List column -->
    <section
      class="flex min-h-0 flex-col lg:border-r-[0.5px] lg:border-zinc-800 {mobileDetail ? 'hidden lg:flex' : 'flex'}"
      aria-label="Findings list"
    >
      <div class="space-y-3 lg:px-4 lg:pt-5">
        <header class="flex items-end justify-between gap-3">
          <div>
            <h1 class="hf-title">Findings</h1>
            <p class="text-xs text-zinc-500">Write once, export to any platform.</p>
          </div>
          <button type="button" class="hf-button-primary" on:click={() => createNew(programFilter === 'all' ? undefined : programFilter)}>
            <Plus size={15} aria-hidden="true" />
            New
          </button>
        </header>

        <div class="hf-segmented flex w-full" role="radiogroup" aria-label="Finding status">
          {#each buckets as item}
            <button
              type="button"
              role="radio"
              aria-checked={bucket === item.id}
              class="hf-segment flex-1 {bucket === item.id ? 'hf-segment-active' : ''}"
              on:click={() => (bucket = item.id)}
            >
              {item.label}
              <span class="tabular-nums text-zinc-500">{counts[item.id]}</span>
            </button>
          {/each}
        </div>

        <div class="flex gap-2">
          <label class="relative block flex-1">
            <span class="sr-only">Search findings</span>
            <Search size={14} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
            <input bind:value={query} class="hf-input pl-8" placeholder="Search title, asset, CWE…" />
          </label>
          <select bind:value={sort} class="hf-select w-28" aria-label="Sort findings">
            <option value="recent">Recent</option>
            <option value="severity">Severity</option>
          </select>
        </div>
        <select bind:value={programFilter} class="hf-select" aria-label="Program">
          <option value="all">All programs</option>
          {#each $targetStore as program}<option value={program.id}>{program.name}</option>{/each}
        </select>
      </div>

      <div class="mt-3 min-h-0 flex-1 overflow-y-auto pb-6 lg:px-2">
        {#if !loaded}
          <div class="space-y-1 p-2">
            {#each Array(5) as _}<div class="h-14 animate-pulse rounded-lg" style="background: var(--hf-fill)"></div>{/each}
          </div>
        {:else if filtered.length === 0}
          <div class="px-4 py-12 text-center">
            <ShieldAlert size={32} strokeWidth={1.5} class="mx-auto text-zinc-600" aria-hidden="true" />
            <p class="mt-2 text-[0.8125rem] font-semibold text-zinc-200">
              {$submissionStore.length === 0 ? 'No findings yet' : 'No matches'}
            </p>
            <p class="mt-1 text-xs text-zinc-500">
              {$submissionStore.length === 0
                ? 'Capture a lead the moment you spot it — you can polish it into a report later.'
                : 'Try another filter or search.'}
            </p>
          </div>
        {:else}
          <ul class="space-y-px" role="listbox" aria-label="Findings">
            {#each filtered as finding (finding.id)}
              {@const active = finding.id === selectedId}
              {@const sla = calculateSla(finding)}
              <li role="option" aria-selected={active}>
                <button
                  type="button"
                  class="hf-finding-row {active ? 'hf-finding-row--active' : ''}"
                  on:click={() => select(finding.id)}
                >
                  <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full {severityDot[finding.severity]}" aria-hidden="true"></span>
                  <span class="min-w-0 flex-1">
                    <span class="flex items-baseline gap-2">
                      <span class="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold text-zinc-100">
                        {finding.title || 'Untitled finding'}
                      </span>
                      <span class="shrink-0 text-[0.6875rem] text-zinc-500">{formatRelativeDate(finding.updatedAt)}</span>
                    </span>
                    <span class="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                      <span class="truncate">{programsById.get(finding.targetId)?.name ?? 'No program'}</span>
                      <span aria-hidden="true">·</span>
                      <span class="shrink-0">{STATUS_LABELS[finding.status]}</span>
                      {#if sla.state === 'overdue'}
                        <span class="shrink-0 font-semibold text-red-400">· overdue</span>
                      {/if}
                    </span>
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </section>

    <!-- Detail column -->
    <section class="min-h-0 {mobileDetail ? 'block' : 'hidden lg:block'}" aria-label="Finding detail">
      {#if selected}
        <div class="hf-card h-full overflow-hidden lg:rounded-none lg:shadow-none" style="background: var(--hf-surface)">
          <FindingEditor
            finding={selected}
            programs={$targetStore}
            reconAssets={$reconAssetStore}
            evidence={$evidenceAssetStore}
            allFindings={$submissionStore}
            payouts={$payoutStore}
            on:change={(event) => save(event.detail)}
            on:delete={(event) => remove(event.detail)}
            on:createEvidence={(event) => createEvidence(event.detail)}
            on:back={() => select('')}
          />
        </div>
      {:else if loaded}
        <div class="flex h-full items-center justify-center p-6">
          {#if $targetStore.length === 0}
            <EmptyState
              icon={ShieldAlert}
              title="Add a program first"
              description="Findings belong to a program so reports know their platform and scope."
              actionLabel="Add Program"
              href="/programs?new=1"
            />
          {:else}
            <div class="text-center">
              <ShieldAlert size={40} strokeWidth={1.3} class="mx-auto text-zinc-600" aria-hidden="true" />
              <p class="mt-3 text-[0.9375rem] font-semibold text-zinc-200">Select a finding</p>
              <p class="mt-1 max-w-xs text-[0.8125rem] text-zinc-500">
                Or start a new one — templates for 26 common bugs fill in CWE, CVSS and a full write-up.
              </p>
              <button type="button" class="hf-button-tinted mt-4" on:click={() => createNew(programFilter === 'all' ? undefined : programFilter)}>
                <Plus size={14} aria-hidden="true" /> New Finding
              </button>
            </div>
          {/if}
        </div>
      {/if}
    </section>
  </div>
</main>

<style>
  .hf-finding-row {
    display: flex;
    width: 100%;
    gap: 0.625rem;
    padding: 0.625rem 0.75rem;
    border-radius: 10px;
    text-align: left;
    transition: background-color 120ms ease;
  }

  .hf-finding-row:hover {
    background: var(--hf-fill);
  }

  .hf-finding-row--active,
  .hf-finding-row--active:hover {
    background: var(--hf-selection);
  }
</style>
