<script lang="ts">
  import SubmissionForm from '$lib/components/submissions/SubmissionForm.svelte';
  import CopyButton from '$lib/components/workspace/CopyButton.svelte';
  import EmptyState from '$lib/components/workspace/EmptyState.svelte';
  import MetricCard from '$lib/components/workspace/MetricCard.svelte';
  import SeverityBadge from '$lib/components/workspace/SeverityBadge.svelte';
  import StatusBadge from '$lib/components/workspace/StatusBadge.svelte';
  import { noteStore, sessionStore, submissionStore, targetStore } from '$lib/stores';
  import type { PayoutSeverity, Submission, SubmissionStatus } from '$lib/types';
  import {
    findingStatusLabels,
    formatDate,
    formatRelativeDate,
    platformLabels,
    severityLabels,
    statusTone
  } from '$lib/utils/workspace';
  import { Clock, Plus, Search, ShieldAlert, Target as TargetIcon } from 'lucide-svelte';
  import { onMount } from 'svelte';

  type StatusFilter = SubmissionStatus | 'all';
  type SeverityFilter = PayoutSeverity | 'all';

  let loaded = false;
  let showForm = false;
  let editing: Submission | null = null;
  let selectedId = '';
  let query = '';
  let programFilter = 'all';
  let statusFilter: StatusFilter = 'all';
  let severityFilter: SeverityFilter = 'all';

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All statuses' },
    { value: 'draft', label: 'Lead' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'triaged', label: 'Triaged' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'duplicate', label: 'Duplicate' },
    { value: 'informational', label: 'Informative' },
    { value: 'not-applicable', label: 'N/A' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'rewarded', label: 'Paid' },
    { value: 'closed', label: 'Closed' }
  ];

  const severityOptions: { value: SeverityFilter; label: string }[] = [
    { value: 'all', label: 'All severities' },
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
    { value: 'informational', label: 'Info' }
  ];

  onMount(async () => {
    await Promise.all([submissionStore.load(), targetStore.load(), noteStore.load(), sessionStore.load()]);
    const params = new URLSearchParams(location.search);
    selectedId = params.get('id') ?? '';
    programFilter = params.get('target') ?? 'all';
    if (params.get('new') === '1') startCreate(programFilter === 'all' ? undefined : programFilter);
    loaded = true;
  });

  function programName(targetId: string): string {
    return $targetStore.find((target) => target.id === targetId)?.name ?? 'Missing program';
  }

  function buildDraft(targetId?: string): Submission | null {
    if ($targetStore.length === 0 && !targetId) return null;
    const now = Date.now();
    const program = $targetStore.find((target) => target.id === targetId) ?? $targetStore[0];
    return {
      id: '',
      title: '',
      targetId: program.id,
      platform: program.platform,
      vulnerabilityType: '',
      severity: 'medium',
      status: 'draft',
      payoutIds: [],
      tags: [],
      timeline: [],
      createdAt: now,
      updatedAt: now
    };
  }

  function startCreate(targetId?: string): void {
    editing = buildDraft(targetId);
    showForm = true;
  }

  function startEdit(submission: Submission): void {
    editing = submission;
    showForm = true;
  }

  async function saveSubmission(event: CustomEvent<{ submission: Submission }>): Promise<void> {
    await submissionStore.put(event.detail.submission);
    await submissionStore.persistNow();
    selectedId = event.detail.submission.id;
    editing = null;
    showForm = false;
  }

  $: findings = $submissionStore;
  $: filteredFindings = findings
    .filter((finding) => {
      if (programFilter !== 'all' && finding.targetId !== programFilter) return false;
      if (statusFilter !== 'all' && finding.status !== statusFilter) return false;
      if (severityFilter !== 'all' && finding.severity !== severityFilter) return false;
      const search = query.trim().toLowerCase();
      if (!search) return true;
      return [
        finding.title,
        finding.vulnerabilityType ?? '',
        finding.reportMarkdown ?? '',
        finding.notes ?? '',
        (finding.tags ?? []).join(' '),
        programName(finding.targetId)
      ]
        .join(' ')
        .toLowerCase()
        .includes(search);
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
  $: selectedFinding = selectedId
    ? $submissionStore.find((finding) => finding.id === selectedId)
    : filteredFindings[0];
  $: criticalHigh = findings.filter((finding) => ['critical', 'high'].includes(finding.severity)).length;
  $: confirmed = findings.filter((finding) => ['submitted', 'triaged', 'accepted', 'resolved', 'rewarded'].includes(finding.status)).length;
  $: paid = findings.filter((finding) => finding.status === 'rewarded').length;
</script>

<svelte:head>
  <title>Findings | HuntFlow bug bounty command center</title>
  <meta name="description" content="Track potential and confirmed vulnerabilities, severity, confidence, evidence, report drafts, and triage outcomes." />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner">
    <header class="hf-page-header">
      <div>
        <p class="hf-eyebrow">Findings</p>
        <h1 class="hf-title">Vulnerability triage</h1>
        <p class="hf-description">
          Track leads, testing state, confirmed bugs, submitted issues, triage outcomes, and payout linkage.
        </p>
      </div>
      <button type="button" class="hf-button-primary" on:click={() => startCreate(programFilter === 'all' ? undefined : programFilter)}>
        <Plus size={17} aria-hidden="true" />
        New Finding
      </button>
    </header>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={ShieldAlert} label="Findings" value={String(findings.length)} detail="Leads through paid outcomes" />
      <MetricCard icon={ShieldAlert} label="Critical/high" value={String(criticalHigh)} detail="Needs careful validation" tone="danger" />
      <MetricCard icon={Clock} label="Confirmed/submitted" value={String(confirmed)} detail="Submitted or beyond" tone="warning" />
      <MetricCard icon={TargetIcon} label="Paid" value={String(paid)} detail="Rewarded findings" tone="success" />
    </section>

    {#if showForm}
      <section class="hf-card p-5">
        <div class="mb-4">
          <h2 class="text-base font-semibold text-zinc-100">{editing?.id ? 'Edit finding' : 'New finding'}</h2>
          <p class="mt-1 text-sm text-zinc-500">Use this for authorized bug bounty findings only. Keep reproduction steps tied to scoped assets.</p>
        </div>
        {#if editing || $targetStore.length > 0}
          <SubmissionForm
            submission={editing}
            targets={$targetStore}
            submitLabel={editing?.id ? 'Save Finding' : 'Create Finding'}
            on:submit={saveSubmission}
            on:cancel={() => {
              showForm = false;
              editing = null;
            }}
          />
        {:else}
          <p class="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">Add a program before capturing findings.</p>
        {/if}
      </section>
    {/if}

    <section class="hf-card p-4">
      <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px_170px_170px]">
        <label class="block">
          <span class="hf-label">Search</span>
          <div class="mt-2 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 focus-within:border-zinc-500 focus-within:ring-2 focus-within:ring-zinc-500/20">
            <Search size={16} class="text-zinc-600" aria-hidden="true" />
            <input bind:value={query} class="min-h-[44px] w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none" placeholder="Title, type, evidence, tags" />
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
          <span class="hf-label">Status</span>
          <select bind:value={statusFilter} class="hf-select mt-2">
            {#each statusOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label class="block">
          <span class="hf-label">Severity</span>
          <select bind:value={severityFilter} class="hf-select mt-2">
            {#each severityOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>
      </div>
    </section>

    {#if filteredFindings.length > 0}
      <section class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <article class="hf-card overflow-hidden">
          <div class="hidden grid-cols-[130px_minmax(220px,1fr)_180px_130px_120px_130px] border-b border-zinc-800 px-4 py-3 text-xs font-medium text-zinc-500 lg:grid">
            <span>Severity</span>
            <span>Title</span>
            <span>Program</span>
            <span>Status</span>
            <span>Confidence</span>
            <span>Updated</span>
          </div>
          <div class="divide-y divide-zinc-900">
            {#each filteredFindings as finding}
              <button
                type="button"
                class="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-zinc-950 lg:grid-cols-[130px_minmax(220px,1fr)_180px_130px_120px_130px] lg:items-center {selectedFinding?.id === finding.id ? 'bg-zinc-950' : ''}"
                on:click={() => (selectedId = finding.id)}
              >
                <SeverityBadge severity={finding.severity} />
                <span class="min-w-0">
                  <span class="block truncate text-sm font-medium text-zinc-100">{finding.title}</span>
                  <span class="mt-1 block truncate text-xs text-zinc-500">{finding.vulnerabilityType ?? 'Unclassified'}</span>
                </span>
                <span class="truncate text-sm text-zinc-400">{programName(finding.targetId)}</span>
                <span><StatusBadge label={findingStatusLabels[finding.status]} tone={statusTone(finding.status)} /></span>
                <span class="text-sm text-zinc-500">{finding.cvssScore ? `${finding.cvssScore}/10` : finding.status === 'draft' ? 'Lead' : 'Tracked'}</span>
                <span class="text-xs text-zinc-500">{formatRelativeDate(finding.updatedAt)}</span>
              </button>
            {/each}
          </div>
        </article>

        {#if selectedFinding}
          <aside class="hf-card sticky top-20 h-fit p-5">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="hf-eyebrow">Finding detail</p>
                <h2 class="mt-2 text-xl font-semibold text-zinc-50">{selectedFinding.title}</h2>
                <p class="mt-2 text-sm text-zinc-500">{programName(selectedFinding.targetId)} · {platformLabels[selectedFinding.platform]}</p>
              </div>
              <SeverityBadge severity={selectedFinding.severity} />
            </div>

            <div class="mt-5 flex flex-wrap gap-2">
              <StatusBadge label={findingStatusLabels[selectedFinding.status]} tone={statusTone(selectedFinding.status)} />
              <StatusBadge label={selectedFinding.vulnerabilityType ?? 'Unclassified'} />
              <StatusBadge label={severityLabels[selectedFinding.severity]} tone={statusTone(selectedFinding.severity)} />
            </div>

            <div class="mt-5 space-y-4">
              <section>
                <p class="hf-label">Summary</p>
                <p class="mt-2 text-sm leading-6 text-zinc-400">{selectedFinding.notes ?? selectedFinding.reportMarkdown ?? 'No summary yet.'}</p>
              </section>
              <section>
                <p class="hf-label">Evidence / reproduction</p>
                <div class="mt-2 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <pre class="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-zinc-300">{selectedFinding.reportMarkdown ?? 'No report draft attached yet.'}</pre>
                </div>
              </section>
              <section class="grid gap-3 sm:grid-cols-2">
                <div>
                  <p class="hf-label">Submitted</p>
                  <p class="mt-2 text-sm text-zinc-300">{formatDate(selectedFinding.submittedAt)}</p>
                </div>
                <div>
                  <p class="hf-label">Payout</p>
                  <p class="mt-2 font-mono text-sm text-zinc-300">{selectedFinding.bountyAmount ? `$${selectedFinding.bountyAmount}` : 'Not recorded'}</p>
                </div>
              </section>
            </div>

            <div class="mt-5 flex flex-wrap gap-2">
              <button type="button" class="hf-button-secondary" on:click={() => startEdit(selectedFinding)}>Edit</button>
              <a href={`/reports?id=${selectedFinding.id}`} class="hf-button-secondary">Open report</a>
              <CopyButton value={selectedFinding.reportMarkdown ?? selectedFinding.notes ?? selectedFinding.title} label="Copy report text" />
            </div>
          </aside>
        {/if}
      </section>
    {:else if loaded}
      <EmptyState
        icon={ShieldAlert}
        title={$submissionStore.length === 0 ? 'No findings yet' : 'No findings match the filters'}
        description={$submissionStore.length === 0
          ? 'Capture leads here before turning them into report-ready submissions.'
          : 'Adjust search, program, status, or severity filters.'}
        actionLabel={$submissionStore.length === 0 ? 'New Finding' : undefined}
        href={$submissionStore.length === 0 ? '/findings?new=1' : undefined}
      />
    {/if}
  </div>
</main>
