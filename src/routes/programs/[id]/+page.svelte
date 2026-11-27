<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import ImportSheet from '$lib/components/imports/ImportSheet.svelte';
  import ProgramActivity from '$lib/components/programs/ProgramActivity.svelte';
  import ProgramChecklists from '$lib/components/programs/ProgramChecklists.svelte';
  import TargetForm from '$lib/components/targets/TargetForm.svelte';
  import CopyButton from '$lib/components/workspace/CopyButton.svelte';
  import EmptyState from '$lib/components/workspace/EmptyState.svelte';
  import SeverityBadge from '$lib/components/workspace/SeverityBadge.svelte';
  import StatusBadge from '$lib/components/workspace/StatusBadge.svelte';
  import {
    noteStore,
    payoutStore,
    reconAssetStore,
    sessionStore,
    submissionStore,
    targetStore
  } from '$lib/stores';
  import type { Target, TargetStatus } from '$lib/types';
  import {
    assetStatusLabels,
    assetTypeFor,
    assetTypeLabels,
    formatDate,
    formatDuration,
    formatMoney,
    formatRelativeDate,
    platformLabels,
    priorityLabels,
    programUrlHost,
    scopeStatusFor,
    scopeStatusLabels,
    statusTone,
    targetStatusLabels
  } from '$lib/utils/workspace';
  import { STATUS_LABELS } from '$lib/utils/findingWorkflow';
  import { evaluateScope, parseScopeRules } from '$lib/utils/scopeValidator';
  import {
    ArrowLeft,
    Download,
    CircleDollarSign,
    ExternalLink,
    FileText,
    FolderKanban,
    Network,
    Play,
    Save,
    ShieldAlert,
    Timer
  } from 'lucide-svelte';
  import { onMount } from 'svelte';

  type Tab = 'overview' | 'scope' | 'targets' | 'checklists' | 'findings' | 'notes' | 'activity' | 'payouts';

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'scope', label: 'Scope' },
    { id: 'targets', label: 'Targets' },
    { id: 'checklists', label: 'Checklists' },
    { id: 'findings', label: 'Findings' },
    { id: 'notes', label: 'Notes' },
    { id: 'activity', label: 'Activity' },
    { id: 'payouts', label: 'Payouts' }
  ];

  // Older links: #reports and #sessions folded into other tabs, and the
  // retired /targets/:id pages redirect here with #methodology/#timeline.
  const TAB_ALIASES: Record<string, Tab> = { reports: 'findings', sessions: 'activity', timeline: 'activity', methodology: 'checklists' };

  const statusPipeline: TargetStatus[] = ['recon', 'testing', 'reported', 'paid', 'closed', 'archived'];

  let loaded = false;
  let activeTab: Tab = 'overview';
  let scopeDraft = '';
  let notesDraft = '';
  let loadedProgramId = '';

  onMount(() => {
    void Promise.all([
      targetStore.load(),
      reconAssetStore.load(),
      sessionStore.load(),
      noteStore.load(),
      submissionStore.load(),
      payoutStore.load()
    ]).then(() => {
      applyHash();
      loaded = true;
    });
    // Links to another tab of this program (#activity…) don't remount.
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  });

  function applyHash(): void {
    const raw = location.hash.replace('#', '');
    const hash = (TAB_ALIASES[raw] ?? raw) as Tab;
    if (tabs.some((tab) => tab.id === hash)) activeTab = hash;
  }

  $: programId = $page.params.id;
  $: program = $targetStore.find((candidate) => candidate.id === programId);
  $: if (program && program.id !== loadedProgramId) {
    loadedProgramId = program.id;
    scopeDraft = program.scope;
    notesDraft = program.notes;
  }
  $: programAssets = $reconAssetStore.filter((asset) => asset.targetId === programId);
  $: programSessions = $sessionStore.filter((session) => session.targetId === programId).sort((a, b) => b.startedAt - a.startedAt);
  $: programNotes = $noteStore.filter((note) => note.targetId === programId).sort((a, b) => b.updatedAt - a.updatedAt);
  $: programSubmissions = $submissionStore.filter((submission) => submission.targetId === programId).sort((a, b) => b.updatedAt - a.updatedAt);
  $: programFindings = programSubmissions;
  $: programPayouts = program
    ? $payoutStore.filter((payout) => payout.program.toLowerCase() === program.name.toLowerCase() || payout.platform === program.platform)
    : [];
  $: completedSeconds = programSessions
    .filter((session) => session.status === 'completed')
    .reduce((sum, session) => sum + session.durationActual, 0);
  $: paidTotal = programPayouts.filter((payout) => payout.status === 'paid').reduce((sum, payout) => sum + payout.amount, 0);
  $: scopeRules = parseScopeRules(scopeDraft).filter((rule) => rule.pattern.type !== 'unknown');
  $: includeRules = scopeRules.filter((rule) => rule.kind === 'include');
  $: excludeRules = scopeRules.filter((rule) => rule.kind === 'exclude');
  let scopeProbe = '';
  $: probeResult = scopeProbe.trim() ? evaluateScope(scopeProbe.trim(), scopeRules) : null;
  $: scopeDirty = Boolean(program) && scopeDraft !== program?.scope;

  let showImport = false;

  async function openImport(): Promise<void> {
    // Save edits first so the import appends to what's on screen.
    if (scopeDirty) await saveScope();
    showImport = true;
  }

  function afterImport(): void {
    const latest = $targetStore.find((candidate) => candidate.id === programId);
    if (latest) scopeDraft = latest.scope;
  }

  function selectTab(tab: Tab): void {
    activeTab = tab;
    if (typeof history !== 'undefined') history.replaceState(history.state, '', `#${tab}`);
  }

  async function saveProgram(event: CustomEvent<{ target: Target }>): Promise<void> {
    await targetStore.put({ ...event.detail.target, status: program?.status ?? event.detail.target.status });
    await targetStore.persistNow();
  }

  async function saveScope(): Promise<void> {
    if (!program) return;
    await targetStore.put({ ...program, scope: scopeDraft, notes: notesDraft, updatedAt: Date.now() });
    await targetStore.persistNow();
  }

  async function setStatus(status: TargetStatus): Promise<void> {
    if (!program) return;
    await targetStore.put({ ...program, status, updatedAt: Date.now() });
    await targetStore.persistNow();
  }
</script>

<svelte:head>
  <title>{program?.name ?? 'Program'} | HuntFlow</title>
  <meta name="description" content="Program detail workspace for scope, targets, sessions, notes, findings, reports, and payouts." />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner">
    <a href="/programs" class="hf-button-ghost w-fit">
      <ArrowLeft size={16} aria-hidden="true" />
      Programs
    </a>

    {#if program}
      <header class="hf-card p-5">
        <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="truncate text-3xl font-semibold text-zinc-50">{program.name}</h1>
              <StatusBadge label={priorityLabels[program.priority]} tone={program.priority <= 1 ? 'warning' : 'neutral'} />
              <StatusBadge label={targetStatusLabels[program.status]} tone={statusTone(program.status)} />
            </div>
            <p class="mt-2 text-sm text-zinc-500">
              {platformLabels[program.platform]} · {programUrlHost(program)} · Last hunted {formatRelativeDate(program.lastSessionAt)}
            </p>
          </div>
          <div class="flex flex-wrap gap-3">
            <a href={`/timer?target=${program.id}`} class="hf-button-primary">
              <Play size={17} aria-hidden="true" />
              Start Session
            </a>
            <a href={`/targets?program=${program.id}`} class="hf-button-secondary">
              <Network size={17} aria-hidden="true" />
              Add Targets
            </a>
            <a href={`/programs/${program.id}/report`} class="hf-button-secondary">
              <FileText size={17} aria-hidden="true" />
              Report
            </a>
            {#if program.programUrl}
              <a href={program.programUrl} target="_blank" rel="noreferrer" class="hf-icon-button" aria-label="Open program">
                <ExternalLink size={16} aria-hidden="true" />
              </a>
            {/if}
          </div>
        </div>
      </header>

      <section class="grid gap-5 md:grid-cols-4">
        <article class="hf-card p-4">
          <p class="text-xs text-zinc-500">Targets</p>
          <p class="mt-2 font-mono text-2xl text-zinc-50">{programAssets.length}</p>
        </article>
        <article class="hf-card p-4">
          <p class="text-xs text-zinc-500">Hunt time</p>
          <p class="mt-2 font-mono text-2xl text-zinc-50">{formatDuration(completedSeconds)}</p>
        </article>
        <article class="hf-card p-4">
          <p class="text-xs text-zinc-500">Findings</p>
          <p class="mt-2 font-mono text-2xl text-zinc-50">{programFindings.length}</p>
        </article>
        <article class="hf-card p-4">
          <p class="text-xs text-zinc-500">Paid</p>
          <p class="mt-2 font-mono text-2xl text-zinc-50">{formatMoney(paidTotal)}</p>
        </article>
      </section>

      <nav class="flex gap-1 overflow-x-auto border-b border-zinc-900 pb-1" aria-label="Program detail tabs">
        {#each tabs as tab}
          <button
            type="button"
            class="min-h-[40px] whitespace-nowrap rounded-lg px-3 text-sm font-medium transition {activeTab === tab.id
              ? 'hf-segment-active text-zinc-50'
              : 'text-zinc-500 hover:bg-[var(--hf-fill)] hover:text-zinc-200'}"
            aria-current={activeTab === tab.id ? 'page' : undefined}
            on:click={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        {/each}
      </nav>

      {#if activeTab === 'overview'}
        <section class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <article class="hf-card p-5">
            <h2 class="text-base font-semibold text-zinc-100">Program overview</h2>
            <div class="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <p class="hf-label">Platform</p>
                <p class="mt-2 text-sm text-zinc-200">{platformLabels[program.platform]}</p>
              </div>
              <div>
                <p class="hf-label">Program URL</p>
                <div class="mt-2 flex items-center gap-2">
                  <p class="min-w-0 truncate font-mono text-sm text-zinc-200">{program.programUrl ?? 'Not set'}</p>
                  <CopyButton value={program.programUrl ?? ''} compact label="Copy program URL" />
                </div>
              </div>
              <div>
                <p class="hf-label">Policy URL</p>
                <p class="mt-2 text-sm text-zinc-500">Use program URL or add policy notes in Scope.</p>
              </div>
              <div>
                <p class="hf-label">Last hunted</p>
                <p class="mt-2 text-sm text-zinc-200">{formatDate(program.lastSessionAt)}</p>
              </div>
            </div>
          </article>

          <article class="hf-card p-5">
            <h2 class="text-base font-semibold text-zinc-100">Status pipeline</h2>
            <div class="mt-4 flex flex-wrap gap-2">
              {#each statusPipeline as status}
                <button
                  type="button"
                  class="min-h-[36px] rounded-full border px-3 text-xs font-medium transition {program.status === status
                    ? 'border-zinc-500 bg-zinc-800 text-zinc-50'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-700 hover:text-zinc-200'}"
                  on:click={() => setStatus(status)}
                >
                  {targetStatusLabels[status]}
                </button>
              {/each}
            </div>
          </article>

          <article class="hf-card p-5 xl:col-span-2">
            <h2 class="mb-4 text-base font-semibold text-zinc-100">Program fields</h2>
            <TargetForm target={program} submitLabel="Save Program" on:submit={saveProgram} on:cancel={() => goto('/programs')} />
          </article>
        </section>
      {:else if activeTab === 'scope'}
        <section class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <article class="hf-card p-5">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 class="text-base font-semibold text-zinc-100">Scope</h2>
                <p class="mt-1 text-sm text-zinc-500">One rule per line. Prefix exclusions with <code class="font-mono">-</code>. Everything else is kept as notes.</p>
              </div>
              <div class="flex shrink-0 gap-2">
                <button type="button" class="hf-button-secondary" on:click={openImport}>
                  <Download size={16} aria-hidden="true" />
                  Import…
                </button>
                <button type="button" class="hf-button-primary" disabled={!scopeDirty && notesDraft === program.notes} on:click={saveScope}>
                  <Save size={16} aria-hidden="true" />
                  Save
                </button>
              </div>
            </div>
            <label class="mt-5 block">
              <span class="hf-label">Scope rules</span>
              <textarea bind:value={scopeDraft} class="hf-input mt-2 min-h-[200px] font-mono sm:min-h-[320px] text-xs leading-6" placeholder="*.example.com&#10;api.example.com&#10;- staging.example.com&#10;# Rate limit: 5 req/sec" />
            </label>
            <label class="mt-4 block">
              <span class="hf-label">Safe testing notes and program-specific rules</span>
              <textarea bind:value={notesDraft} class="hf-input mt-2 min-h-[120px] leading-6 sm:min-h-[180px]" placeholder="Credentials, roles, forbidden tests, disclosure notes..." />
            </label>
          </article>
          <article class="hf-card p-5">
            <h2 class="text-base font-semibold text-zinc-100">Check a URL</h2>
            <input bind:value={scopeProbe} class="hf-input mt-3 font-mono text-xs" placeholder="https://admin.example.com/login" aria-label="URL to check against scope" />
            {#if probeResult}
              <p
                class="mt-2 rounded-[10px] px-3 py-2 text-[0.8125rem] {probeResult.verdict === 'in-scope'
                  ? 'bg-green-500/[0.12] text-green-600 dark:text-green-400'
                  : probeResult.verdict === 'out-of-scope'
                    ? 'bg-red-500/[0.12] text-red-600 dark:text-red-400'
                    : 'bg-zinc-500/[0.12] text-zinc-400'}"
                role="status"
              >
                <span class="font-semibold">{probeResult.verdict === 'in-scope' ? 'In scope' : probeResult.verdict === 'out-of-scope' ? 'Out of scope' : 'No rules yet'}.</span>
                {probeResult.matchedRule ? `Matches ${probeResult.matchedRule.raw.replace(/^\s*(?:[-!+]|in:|out:)\s*/i, '')}` : probeResult.reason}
              </p>
            {/if}
            {#if scopeRules.length > 0}
              {#each [{ title: 'In scope', rules: includeRules, dot: 'bg-green-500' }, { title: 'Out of scope', rules: excludeRules, dot: 'bg-red-500' }] as group}
                {#if group.rules.length}
                  <h3 class="mt-5 text-xs font-semibold text-zinc-400">{group.title} · {group.rules.length}</h3>
                  <ul class="hf-list mt-2 overflow-hidden rounded-[10px]" style="background: var(--hf-fill)">
                    {#each group.rules.slice(0, 30) as rule}
                      <li class="flex items-center gap-2.5 px-3 py-2">
                        <span class="h-1.5 w-1.5 shrink-0 rounded-full {group.dot}" aria-hidden="true"></span>
                        <span class="min-w-0 break-all font-mono text-xs text-zinc-200">{rule.raw.replace(/^\s*(?:[-!+]|in:|out:)\s*/i, '')}</span>
                      </li>
                    {/each}
                    {#if group.rules.length > 30}
                      <li class="px-3 py-2 text-xs text-zinc-500">and {group.rules.length - 30} more</li>
                    {/if}
                  </ul>
                {/if}
              {/each}
            {:else}
              <p class="mt-5 rounded-[10px] px-3 py-3 text-[0.8125rem] text-zinc-500" style="background: var(--hf-fill)">
                No rules yet. Import the program's scope to flag out-of-scope hosts automatically.
              </p>
            {/if}
          </article>
        </section>
      {:else if activeTab === 'targets'}
        {#if programAssets.length > 0}
          <section class="grid gap-4 lg:grid-cols-2">
            {#each programAssets as asset}
              <a href={`/targets?asset=${asset.id}`} class="hf-card hf-interactive block p-4">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate font-mono text-sm text-zinc-100">{asset.url ?? asset.hostname}</p>
                    <p class="mt-1 text-xs text-zinc-500">{assetTypeLabels[assetTypeFor(asset)]} · {scopeStatusLabels[scopeStatusFor(asset)]}</p>
                  </div>
                  <StatusBadge label={assetStatusLabels[asset.status]} tone={statusTone(asset.status)} />
                </div>
              </a>
            {/each}
          </section>
        {:else}
          <EmptyState icon={Network} title="No targets yet" description="Import scope or recon output, or add targets by hand." actionLabel="Import Targets" href={`/targets?program=${program.id}&import=1`} />
        {/if}
      {:else if activeTab === 'checklists'}
        <ProgramChecklists programId={program.id} />
      {:else if activeTab === 'activity'}
        <ProgramActivity programId={program.id} />
      {:else if activeTab === 'notes'}
        {#if programNotes.length > 0}
          <section class="grid gap-4 lg:grid-cols-2">
            {#each programNotes as note}
              <a href={`/notes/${note.id}`} class="hf-card hf-interactive block p-4">
                <p class="truncate text-sm font-medium text-zinc-100">{note.title || 'Untitled note'}</p>
                <p class="mt-1 text-xs text-zinc-500">Updated {formatRelativeDate(note.updatedAt)}</p>
              </a>
            {/each}
          </section>
        {:else}
          <EmptyState icon={FileText} title="No notes yet" description="Capture recon notes, payloads, observations, leads, dead ends, and report snippets." actionLabel="New Note" href={`/notes/new?target=${program.id}`} />
        {/if}
      {:else if activeTab === 'findings'}
        {#if programFindings.length > 0}
          <section class="hf-card divide-y divide-zinc-900 overflow-hidden">
            {#each programFindings as finding}
              <a href={`/findings?id=${finding.id}`} class="grid gap-4 px-4 py-3 transition hover:bg-zinc-950 sm:grid-cols-[140px_1fr_120px] sm:items-center">
                <SeverityBadge severity={finding.severity} />
                <span class="min-w-0">
                  <span class="block truncate text-sm font-medium text-zinc-100">{finding.title}</span>
                  <span class="text-xs text-zinc-500">{finding.vulnerabilityType ?? 'Unclassified'} · {formatRelativeDate(finding.updatedAt)}</span>
                </span>
                <StatusBadge label={STATUS_LABELS[finding.status]} tone={statusTone(finding.status)} />
              </a>
            {/each}
          </section>
        {:else}
          <EmptyState icon={ShieldAlert} title="No findings yet" description="Capture leads as drafts, turn them into report-ready write-ups, or import nuclei and Burp results." actionLabel="New Finding" href={`/findings?target=${program.id}&new=1`} />
        {/if}
      {:else if activeTab === 'payouts'}
        {#if programPayouts.length > 0}
          <section class="hf-card divide-y divide-zinc-900 overflow-hidden">
            {#each programPayouts as payout}
              <a href="/payouts" class="grid gap-4 px-4 py-3 transition hover:bg-zinc-950 sm:grid-cols-[1fr_130px_120px] sm:items-center">
                <span>
                  <span class="block text-sm font-medium text-zinc-100">{payout.program}</span>
                  <span class="text-xs text-zinc-500">{formatDate(payout.date)}</span>
                </span>
                <span class="font-mono text-sm text-zinc-100">{formatMoney(payout.amount)}</span>
                <StatusBadge label={payout.status} tone={statusTone(payout.status)} />
              </a>
            {/each}
          </section>
        {:else}
          <EmptyState icon={CircleDollarSign} title="No payouts yet" description="Accepted report outcomes and payout records for this program will show here." actionLabel="Add Payout" href="/payouts?new=1" />
        {/if}
      {/if}
    {:else if loaded}
      <EmptyState icon={FolderKanban} title="Program not found" description="This program may have been deleted or imported into a different local workspace." actionLabel="Back to Programs" href="/programs" />
    {/if}
  </div>
</main>

{#if program}
  <ImportSheet open={showImport} programId={program.id} lockProgram on:close={() => (showImport = false)} on:imported={afterImport} />
{/if}
