<script lang="ts">
  import CopyButton from '$lib/components/workspace/CopyButton.svelte';
  import EmptyState from '$lib/components/workspace/EmptyState.svelte';
  import MetricCard from '$lib/components/workspace/MetricCard.svelte';
  import StatusBadge from '$lib/components/workspace/StatusBadge.svelte';
  import { noteStore, reconAssetStore, submissionStore, targetStore } from '$lib/stores';
  import type {
    Priority,
    ReconAsset,
    ReconAssetStatus,
    ScopeStatus,
    Target,
    TargetAssetType
  } from '$lib/types';
  import {
    assetStatusLabels,
    assetTypeFor,
    assetTypeLabels,
    formatRelativeDate,
    platformLabels,
    priorityLabels,
    scopeStatusFor,
    scopeStatusLabels,
    statusTone
  } from '$lib/utils/workspace';
  import { Filter, Plus, Search, ShieldCheck, Target as TargetIcon } from 'lucide-svelte';
  import { onMount } from 'svelte';

  type ScopeFilter = ScopeStatus | 'all';
  type TypeFilter = TargetAssetType | 'all';
  type PriorityFilter = Priority | 'all';
  type StatusFilter = ReconAssetStatus | 'all';

  let loaded = false;
  let showForm = false;
  let selectedAssetId = '';
  let query = '';
  let programFilter = 'all';
  let scopeFilter: ScopeFilter = 'all';
  let typeFilter: TypeFilter = 'all';
  let priorityFilter: PriorityFilter = 'all';
  let statusFilter: StatusFilter = 'all';
  let tagFilter = '';

  let formProgramId = '';
  let identifier = '';
  let assetType: TargetAssetType = 'web';
  let scopeStatus: ScopeStatus = 'in-scope';
  let priority: Priority = 2;
  let status: ReconAssetStatus = 'untested';
  let technologiesInput = '';
  let portsInput = '';
  let notes = '';
  let tagsInput = '';
  let error = '';

  const assetTypeOptions: { value: TargetAssetType; label: string }[] = [
    { value: 'web', label: 'Web' },
    { value: 'api', label: 'API' },
    { value: 'mobile', label: 'Mobile' },
    { value: 'cloud', label: 'Cloud' },
    { value: 'source-code', label: 'Source Code' },
    { value: 'other', label: 'Other' }
  ];

  const statusOptions: { value: ReconAssetStatus; label: string }[] = [
    { value: 'untested', label: 'New' },
    { value: 'in-progress', label: 'Testing' },
    { value: 'tested', label: 'Done' },
    { value: 'safe', label: 'Done / Safe' },
    { value: 'vulnerable', label: 'Potential finding' },
    { value: 'out-of-scope', label: 'Out of scope' },
    { value: 'dead', label: 'Blocked / Dead' }
  ];

  onMount(async () => {
    await Promise.all([targetStore.load(), reconAssetStore.load(), noteStore.load(), submissionStore.load()]);
    const params = new URLSearchParams(location.search);
    const program = params.get('program');
    if (program) {
      programFilter = program;
      formProgramId = program;
    }
    selectedAssetId = params.get('asset') ?? '';
    showForm = params.get('new') === '1';
    loaded = true;
  });

  function programFor(id: string): Target | undefined {
    return $targetStore.find((program) => program.id === id);
  }

  function resetForm(): void {
    identifier = '';
    assetType = 'web';
    scopeStatus = 'in-scope';
    priority = 2;
    status = 'untested';
    technologiesInput = '';
    portsInput = '';
    notes = '';
    tagsInput = '';
    error = '';
  }

  function normalizeIdentifier(value: string): { hostname: string; url?: string; ipAddress?: string } {
    const trimmed = value.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      return { hostname: url.hostname, url: trimmed };
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed) || trimmed.includes(':')) {
      return { hostname: trimmed, ipAddress: trimmed };
    }
    return { hostname: trimmed };
  }

  async function createAsset(): Promise<void> {
    error = '';
    if (!formProgramId) {
      error = 'Choose a program.';
      return;
    }
    if (!identifier.trim()) {
      error = 'Enter a URL, domain, IP, API, app, or repository name.';
      return;
    }

    let normalized: { hostname: string; url?: string; ipAddress?: string };
    try {
      normalized = normalizeIdentifier(identifier);
    } catch {
      error = 'Enter a valid URL or a plain domain/IP/app name.';
      return;
    }

    const now = Date.now();
    const next: ReconAsset = {
      id: crypto.randomUUID(),
      targetId: formProgramId,
      hostname: normalized.hostname,
      url: normalized.url,
      ipAddress: normalized.ipAddress,
      assetType,
      scopeStatus,
      priority,
      status: scopeStatus === 'out-of-scope' ? 'out-of-scope' : status,
      inScope: scopeStatus !== 'out-of-scope',
      technologies: technologiesInput
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      ports: portsInput
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isFinite(item) && item > 0),
      notes: notes.trim() || undefined,
      source: 'manual',
      tags: tagsInput
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
      discoveredAt: now,
      createdAt: now,
      updatedAt: now
    };

    await reconAssetStore.put(next);
    await reconAssetStore.persistNow();
    selectedAssetId = next.id;
    showForm = false;
    resetForm();
  }

  async function updateAsset(asset: ReconAsset, patch: Partial<ReconAsset>): Promise<void> {
    await reconAssetStore.put({ ...asset, ...patch, updatedAt: Date.now() });
    await reconAssetStore.persistNow();
  }

  async function deleteAsset(asset: ReconAsset): Promise<void> {
    if (!confirm(`Delete target asset "${asset.hostname}"?`)) return;
    await reconAssetStore.delete(asset.id);
    await reconAssetStore.persistNow();
    if (selectedAssetId === asset.id) selectedAssetId = '';
  }

  function handleSelectedStatusChange(event: Event): void {
    if (!selectedAsset) return;
    const status = (event.currentTarget as HTMLSelectElement).value as ReconAssetStatus;
    void updateAsset(selectedAsset, { status });
  }

  function handleSelectedScopeChange(event: Event): void {
    if (!selectedAsset) return;
    const next = (event.currentTarget as HTMLSelectElement).value as ScopeStatus;
    void updateAsset(selectedAsset, { scopeStatus: next, inScope: next !== 'out-of-scope' });
  }

  function handleSelectedNotesChange(event: Event): void {
    if (!selectedAsset) return;
    void updateAsset(selectedAsset, { notes: (event.currentTarget as HTMLTextAreaElement).value });
  }

  function linkedNotes(asset: ReconAsset): number {
    const haystack = `${asset.hostname} ${asset.url ?? ''}`;
    return $noteStore.filter((note) => note.targetId === asset.targetId && note.content.includes(haystack)).length;
  }

  function linkedFindings(asset: ReconAsset): number {
    const haystack = `${asset.hostname} ${asset.url ?? ''}`.toLowerCase();
    return $submissionStore.filter((submission) =>
      submission.targetId === asset.targetId &&
      [submission.title, submission.reportMarkdown ?? '', submission.notes ?? ''].join(' ').toLowerCase().includes(haystack)
    ).length;
  }

  $: if (!formProgramId && $targetStore.length > 0) formProgramId = programFilter !== 'all' ? programFilter : $targetStore[0].id;
  $: allTags = Array.from(new Set($reconAssetStore.flatMap((asset) => asset.tags ?? []))).sort();
  $: filteredAssets = $reconAssetStore
    .filter((asset) => {
      if (programFilter !== 'all' && asset.targetId !== programFilter) return false;
      if (scopeFilter !== 'all' && scopeStatusFor(asset) !== scopeFilter) return false;
      if (typeFilter !== 'all' && assetTypeFor(asset) !== typeFilter) return false;
      if (priorityFilter !== 'all' && (asset.priority ?? programFor(asset.targetId)?.priority ?? 3) !== priorityFilter) return false;
      if (statusFilter !== 'all' && asset.status !== statusFilter) return false;
      if (tagFilter && !(asset.tags ?? []).includes(tagFilter)) return false;
      const search = query.trim().toLowerCase();
      if (!search) return true;
      return [
        asset.hostname,
        asset.url ?? '',
        asset.ipAddress ?? '',
        asset.title ?? '',
        asset.technologies.join(' '),
        asset.notes ?? '',
        (asset.tags ?? []).join(' '),
        programFor(asset.targetId)?.name ?? ''
      ]
        .join(' ')
        .toLowerCase()
        .includes(search);
    })
    .sort((a, b) => {
      const aPriority = a.priority ?? programFor(a.targetId)?.priority ?? 3;
      const bPriority = b.priority ?? programFor(b.targetId)?.priority ?? 3;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return b.updatedAt - a.updatedAt;
    });
  $: selectedAsset = selectedAssetId
    ? $reconAssetStore.find((asset) => asset.id === selectedAssetId)
    : filteredAssets[0];
  $: inScopeCount = $reconAssetStore.filter((asset) => scopeStatusFor(asset) === 'in-scope').length;
  $: testingCount = $reconAssetStore.filter((asset) => ['untested', 'in-progress', 'vulnerable'].includes(asset.status)).length;
  $: vulnerableCount = $reconAssetStore.filter((asset) => asset.status === 'vulnerable').length;
</script>

<svelte:head>
  <title>Targets | HuntFlow bug bounty command center</title>
  <meta name="description" content="Manage in-scope URLs, domains, IPs, APIs, apps, source code targets, status, priority, and linked notes." />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner">
    <header class="hf-page-header">
      <div>
        <p class="hf-eyebrow">Targets</p>
        <h1 class="hf-title">In-scope assets</h1>
        <p class="hf-description">
          Manage the concrete domains, URLs, APIs, mobile apps, cloud assets, and repositories you test inside each program.
        </p>
      </div>
      <button type="button" class="hf-button-primary" on:click={() => (showForm = !showForm)}>
        <Plus size={17} aria-hidden="true" />
        Add Target
      </button>
    </header>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={TargetIcon} label="All targets" value={String($reconAssetStore.length)} detail="Recon assets tracked" />
      <MetricCard icon={ShieldCheck} label="In scope" value={String(inScopeCount)} detail="Safe to test when policy allows" />
      <MetricCard icon={Filter} label="Needs attention" value={String(testingCount)} detail="New, testing, or potential finding" tone="warning" />
      <MetricCard icon={TargetIcon} label="Potential findings" value={String(vulnerableCount)} detail="Marked vulnerable" tone="danger" />
    </section>

    {#if showForm}
      <section class="hf-card p-5">
        <div class="mb-4">
          <h2 class="text-base font-semibold text-zinc-100">New target asset</h2>
          <p class="mt-1 text-sm text-zinc-500">Add in-scope assets manually. HuntFlow keeps the asset linked to its local program.</p>
        </div>
        <form class="grid gap-4" on:submit|preventDefault={createAsset}>
          <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <label class="block">
              <span class="hf-label">URL, domain, IP, API, app, or repo</span>
              <input bind:value={identifier} class="hf-input mt-2 font-mono text-sm" placeholder="https://app.example.com or api.example.com" />
            </label>
            <label class="block">
              <span class="hf-label">Program</span>
              <select bind:value={formProgramId} class="hf-select mt-2" required>
                {#each $targetStore as program}
                  <option value={program.id}>{program.name}</option>
                {/each}
              </select>
            </label>
          </div>

          <div class="grid gap-4 md:grid-cols-4">
            <label class="block">
              <span class="hf-label">Type</span>
              <select bind:value={assetType} class="hf-select mt-2">
                {#each assetTypeOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </label>
            <label class="block">
              <span class="hf-label">Scope status</span>
              <select bind:value={scopeStatus} class="hf-select mt-2">
                <option value="in-scope">In scope</option>
                <option value="out-of-scope">Out of scope</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>
            <label class="block">
              <span class="hf-label">Priority</span>
              <select bind:value={priority} class="hf-select mt-2">
                <option value={0}>High</option>
                <option value={1}>High</option>
                <option value={2}>Medium</option>
                <option value={3}>Low</option>
              </select>
            </label>
            <label class="block">
              <span class="hf-label">Status</span>
              <select bind:value={status} class="hf-select mt-2">
                {#each statusOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </label>
          </div>

          <div class="grid gap-4 md:grid-cols-3">
            <label class="block">
              <span class="hf-label">Tech stack</span>
              <input bind:value={technologiesInput} class="hf-input mt-2" placeholder="Next.js, GraphQL, AWS" />
            </label>
            <label class="block">
              <span class="hf-label">Ports</span>
              <input bind:value={portsInput} class="hf-input mt-2 font-mono text-sm" placeholder="80,443,8080" />
            </label>
            <label class="block">
              <span class="hf-label">Tags</span>
              <input bind:value={tagsInput} class="hf-input mt-2" placeholder="auth, admin, api" />
            </label>
          </div>

          <label class="block">
            <span class="hf-label">Notes</span>
            <textarea bind:value={notes} class="hf-input mt-2 min-h-[100px]" placeholder="Scope caveats, testing notes, credentials, blockers..." />
          </label>

          {#if error}
            <p class="text-sm text-red-300" role="alert">{error}</p>
          {/if}

          <div class="flex flex-wrap justify-end gap-3">
            <button type="button" class="hf-button-secondary" on:click={() => (showForm = false)}>Cancel</button>
            <button type="submit" class="hf-button-primary">Create Target</button>
          </div>
        </form>
      </section>
    {/if}

    <section class="hf-card p-4">
      <div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_190px_150px_150px_150px_150px]">
        <label class="block">
          <span class="hf-label">Search</span>
          <div class="mt-2 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 focus-within:border-zinc-500 focus-within:ring-2 focus-within:ring-zinc-500/20">
            <Search size={16} class="text-zinc-600" aria-hidden="true" />
            <input bind:value={query} class="min-h-[44px] w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none" placeholder="URL, domain, tech, tags" />
          </div>
        </label>
        <label class="block">
          <span class="hf-label">Program</span>
          <select bind:value={programFilter} class="hf-select mt-2">
            <option value="all">All programs</option>
            {#each $targetStore as program}
              <option value={program.id}>{program.name}</option>
            {/each}
          </select>
        </label>
        <label class="block">
          <span class="hf-label">Scope</span>
          <select bind:value={scopeFilter} class="hf-select mt-2">
            <option value="all">All scope</option>
            <option value="in-scope">In scope</option>
            <option value="out-of-scope">Out of scope</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label class="block">
          <span class="hf-label">Type</span>
          <select bind:value={typeFilter} class="hf-select mt-2">
            <option value="all">All types</option>
            {#each assetTypeOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label class="block">
          <span class="hf-label">Priority</span>
          <select bind:value={priorityFilter} class="hf-select mt-2">
            <option value="all">All priorities</option>
            <option value={0}>High</option>
            <option value={1}>High</option>
            <option value={2}>Medium</option>
            <option value={3}>Low</option>
          </select>
        </label>
        <label class="block">
          <span class="hf-label">Status</span>
          <select bind:value={statusFilter} class="hf-select mt-2">
            <option value="all">All statuses</option>
            {#each statusOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>
      </div>
      {#if allTags.length > 0}
        <div class="mt-3 flex flex-wrap gap-2">
          <button type="button" class="hf-chip {tagFilter === '' ? 'hf-chip-active' : ''}" on:click={() => (tagFilter = '')}>All tags</button>
          {#each allTags as tag}
            <button type="button" class="hf-chip {tagFilter === tag ? 'hf-chip-active' : ''}" on:click={() => (tagFilter = tag)}>#{tag}</button>
          {/each}
        </div>
      {/if}
    </section>

    {#if filteredAssets.length > 0}
      <section class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div class="grid gap-3 md:grid-cols-2">
          {#each filteredAssets as asset}
            {@const program = programFor(asset.targetId)}
            <button
              type="button"
              class="hf-card hf-interactive block p-4 text-left {selectedAsset?.id === asset.id ? 'border-zinc-500 bg-zinc-950' : ''}"
              on:click={() => (selectedAssetId = asset.id)}
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate font-mono text-sm text-zinc-100">{asset.url ?? asset.hostname}</p>
                  <p class="mt-1 text-xs text-zinc-500">{program?.name ?? 'Missing program'} · {assetTypeLabels[assetTypeFor(asset)]}</p>
                </div>
                <StatusBadge label={assetStatusLabels[asset.status]} tone={statusTone(asset.status)} />
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                <StatusBadge label={scopeStatusLabels[scopeStatusFor(asset)]} tone={scopeStatusFor(asset) === 'in-scope' ? 'success' : scopeStatusFor(asset) === 'unknown' ? 'warning' : 'neutral'} />
                <StatusBadge label={priorityLabels[asset.priority ?? program?.priority ?? 3]} tone={(asset.priority ?? program?.priority ?? 3) <= 1 ? 'warning' : 'neutral'} />
              </div>
              <div class="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                <span>{linkedNotes(asset)} linked notes</span>
                <span>{linkedFindings(asset)} linked findings</span>
                <span>Updated {formatRelativeDate(asset.updatedAt)}</span>
              </div>
            </button>
          {/each}
        </div>

        {#if selectedAsset}
          {@const program = programFor(selectedAsset.targetId)}
          <aside class="hf-card sticky top-20 h-fit p-5">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="hf-eyebrow">Target detail</p>
                <h2 class="mt-2 truncate font-mono text-lg font-semibold text-zinc-50">{selectedAsset.url ?? selectedAsset.hostname}</h2>
                <p class="mt-1 text-sm text-zinc-500">{program?.name ?? 'Missing program'} · {program ? platformLabels[program.platform] : 'No platform'}</p>
              </div>
              <CopyButton value={selectedAsset.url ?? selectedAsset.hostname} compact label="Copy target" />
            </div>

            <div class="mt-5 grid gap-3">
              <label>
                <span class="hf-label">Status</span>
                <select value={selectedAsset.status} class="hf-select mt-2" on:change={handleSelectedStatusChange}>
                  {#each statusOptions as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              </label>
              <label>
                <span class="hf-label">Scope status</span>
                <select value={scopeStatusFor(selectedAsset)} class="hf-select mt-2" on:change={handleSelectedScopeChange}>
                  <option value="in-scope">In scope</option>
                  <option value="out-of-scope">Out of scope</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>
              <label>
                <span class="hf-label">Notes</span>
                <textarea
                  value={selectedAsset.notes ?? ''}
                  class="hf-input mt-2 min-h-[120px]"
                  on:change={handleSelectedNotesChange}
                />
              </label>
            </div>

            <div class="mt-5 grid gap-2">
              <a href={`/notes/new?target=${selectedAsset.targetId}`} class="hf-button-secondary">New linked note</a>
              <a href={`/findings?target=${selectedAsset.targetId}&new=1`} class="hf-button-secondary">Capture finding</a>
              <button type="button" class="hf-button-secondary border-red-500/30 text-red-300 hover:bg-red-500/10" on:click={() => deleteAsset(selectedAsset)}>Delete target</button>
            </div>
          </aside>
        {/if}
      </section>
    {:else if loaded}
      <EmptyState
        icon={TargetIcon}
        title={$reconAssetStore.length === 0 ? 'No targets yet' : 'No targets match the filters'}
        description={$reconAssetStore.length === 0
          ? 'Add in-scope assets manually or paste scope from a program page.'
          : 'Adjust search, program, scope, type, priority, status, or tags.'}
        actionLabel={$reconAssetStore.length === 0 ? 'Add Target' : undefined}
        href={$reconAssetStore.length === 0 ? '/targets?new=1' : undefined}
      />
    {/if}
  </div>
</main>
