<script lang="ts">
  import SlaIndicator from '$lib/components/submissions/SlaIndicator.svelte';
  import SubmissionForm from '$lib/components/submissions/SubmissionForm.svelte';
  import WeeklyRecap from '$lib/components/submissions/WeeklyRecap.svelte';
  import PlatformIcon from '$lib/components/targets/PlatformIcon.svelte';
  import MetricCard from '$lib/components/workspace/MetricCard.svelte';
  import {
    noteStore,
    payoutStore,
    sessionStore,
    submissionStore,
    targetStore
  } from '$lib/stores';
  import type {
    Note,
    PayoutSeverity,
    Submission,
    SubmissionStatus
  } from '$lib/types';
  import {
    Award,
    Clock,
    DollarSign,
    ExternalLink,
    Pencil,
    Plus,
    Send,
    Target as TargetIcon,
    Trash2
  } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  type StatusFilter = SubmissionStatus | 'all';
  type SeverityFilter = PayoutSeverity | 'all';

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'triaged', label: 'Triaged' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'duplicate', label: 'Duplicate' },
    { value: 'informational', label: 'Informational' },
    { value: 'not-applicable', label: 'Not Applicable' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'rewarded', label: 'Rewarded' },
    { value: 'closed', label: 'Closed' }
  ];

  const severityOptions: { value: PayoutSeverity; label: string }[] = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
    { value: 'informational', label: 'Informational' }
  ];

  let showForm = false;
  let editing: Submission | null = null;
  let fromNoteId = '';
  let query = '';
  let statusFilter: StatusFilter = 'all';
  let severityFilter: SeverityFilter = 'all';
  let targetFilter = 'all';

  onMount(async () => {
    await Promise.all([
      submissionStore.load(),
      targetStore.load(),
      payoutStore.load(),
      // Sessions are needed for the WeeklyRecap focus-time aggregation.
      sessionStore.load(),
      // Notes are loaded so we can hydrate the draft when arriving via
      // the "Promote to submission" flow with `?fromNote=<id>`.
      noteStore.load()
    ]);
    const target = $page.url.searchParams.get('target');
    if (target) targetFilter = target;
    const action = $page.url.searchParams.get('new');
    if (action === '1') showForm = true;

    const noteId = $page.url.searchParams.get('fromNote');
    if (noteId) {
      const note = noteStore.getById(noteId) ?? $noteStore.find((entry) => entry.id === noteId);
      if (note) {
        editing = buildDraftFromNote(note);
        fromNoteId = note.id;
        showForm = true;
      }
    }
  });

  /**
   * Convert a hunter note into a half-completed Submission so the form
   * lands pre-filled. The note's content becomes `reportMarkdown` (the
   * canonical write-up field) AND `notes` (working scratchpad) — both
   * are usually the same draft text right at promotion time, but the
   * hunter can diverge them as they polish the report.
   */
  function buildDraftFromNote(note: Note): Submission {
    const now = Date.now();
    return {
      id: '',
      title: note.title,
      targetId: note.targetId,
      noteId: note.id,
      platform: 'hackerone',
      severity: note.severity ?? 'medium',
      cvssScore: note.cvssScore,
      cvssVector: note.cvssVector,
      status: 'draft',
      reportMarkdown: note.content,
      notes: note.content,
      payoutIds: [],
      tags: [...note.tags],
      timeline: [],
      createdAt: now,
      updatedAt: now
    };
  }

  $: targetMap = new Map($targetStore.map((t) => [t.id, t]));

  $: submissionsCount = $submissionStore.length;
  $: rewardedCount = $submissionStore.filter((s) => s.status === 'rewarded' || s.status === 'resolved').length;
  $: pendingCount = $submissionStore.filter((s) =>
    ['submitted', 'triaged', 'accepted'].includes(s.status)
  ).length;

  $: totalBounty = Math.round(
    $submissionStore.filter((s) => s.status === 'rewarded').reduce((sum, s) => sum + (s.bountyAmount ?? 0), 0) * 100
  ) / 100;

  $: avgTimeToReward = (() => {
    const rewarded = $submissionStore.filter(
      (s) => s.submittedAt && s.rewardedAt && s.rewardedAt > s.submittedAt
    );
    if (rewarded.length === 0) return 0;
    const total = rewarded.reduce(
      (sum, s) => sum + (s.rewardedAt! - s.submittedAt!),
      0
    );
    return Math.round(total / rewarded.length / (1000 * 60 * 60 * 24));
  })();

  $: filtered = $submissionStore
    .filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (severityFilter !== 'all' && s.severity !== severityFilter) return false;
      if (targetFilter !== 'all' && s.targetId !== targetFilter) return false;
      const search = query.trim().toLowerCase();
      if (!search) return true;
      // `tags` may be undefined on submissions migrated from legacy payouts
      // or older schemas — guard before calling `.some`.
      const tags = s.tags ?? [];
      return (
        s.title.toLowerCase().includes(search) ||
        (s.vulnerabilityType ?? '').toLowerCase().includes(search) ||
        tags.some((tag) => tag.toLowerCase().includes(search))
      );
    })
    .sort((a, b) => (b.submittedAt ?? b.updatedAt) - (a.submittedAt ?? a.updatedAt));

  function money(value: number): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  }

  function formatDate(timestamp?: number): string {
    if (!timestamp) return '—';
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(timestamp));
  }

  function statusLabel(value: SubmissionStatus): string {
    return statusOptions.find((option) => option.value === value)?.label ?? value;
  }

  function statusClass(value: SubmissionStatus): string {
    if (value === 'rewarded' || value === 'resolved')
      return 'border-green-500/30 bg-green-500/15 text-green-300';
    if (value === 'accepted' || value === 'triaged')
      return 'border-blue-500/30 bg-blue-500/15 text-blue-300';
    if (value === 'duplicate' || value === 'informational' || value === 'not-applicable')
      return 'border-zinc-500/30 bg-zinc-700/30 text-zinc-300';
    if (value === 'closed') return 'border-zinc-600/40 bg-zinc-800 text-zinc-400';
    if (value === 'submitted') return 'border-amber-500/30 bg-amber-500/15 text-amber-300';
    return 'border-zinc-600/40 bg-zinc-800 text-zinc-400';
  }

  function severityClass(value: PayoutSeverity): string {
    if (value === 'critical') return 'border-red-500/30 bg-red-500/15 text-red-300';
    if (value === 'high') return 'border-orange-500/30 bg-orange-500/15 text-orange-300';
    if (value === 'medium') return 'border-yellow-500/30 bg-yellow-500/15 text-yellow-300';
    if (value === 'low') return 'border-sky-500/30 bg-sky-500/15 text-sky-300';
    return 'border-zinc-500/30 bg-zinc-700/30 text-zinc-300';
  }

  function startCreate(): void {
    editing = null;
    fromNoteId = '';
    showForm = true;
  }

  function startEdit(submission: Submission): void {
    editing = submission;
    fromNoteId = '';
    showForm = true;
  }

  async function saveSubmission(event: CustomEvent<{ submission: Submission }>): Promise<void> {
    await submissionStore.put(event.detail.submission);
    await submissionStore.persistNow();
    showForm = false;
    editing = null;
    fromNoteId = '';
  }

  async function deleteSubmission(submission: Submission): Promise<void> {
    if (!confirm(`Delete "${submission.title}"?`)) return;
    await submissionStore.delete(submission.id);
    await submissionStore.persistNow();
  }
</script>

<svelte:head>
  <title>Submissions | HuntFlow</title>
  <meta name="description" content="Track every report from draft through triage, resolution and reward." />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner">
    <header class="hf-page-header">
      <div>
        <p class="hf-eyebrow">Pipeline</p>
        <h1 class="hf-title">Submissions</h1>
        <p class="hf-description">
          Track every report from draft through triage, resolution, and reward.
        </p>
      </div>
      <button type="button" class="hf-button-primary" on:click={startCreate}>
        <Plus size={20} aria-hidden="true" />
        New Submission
      </button>
    </header>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={Send} label="Reports" value={String(submissionsCount)} detail="all submissions" href="/findings" />
      <MetricCard icon={Clock} label="In triage" value={String(pendingCount)} detail="awaiting decision" href="/findings" tone="warning" />
      <MetricCard icon={Award} label="Resolved" value={String(rewardedCount)} detail="incl. rewarded" href="/findings" tone="info" />
      <MetricCard
        icon={DollarSign}
        label="Total bounty"
        value={money(totalBounty)}
        detail={avgTimeToReward > 0 ? `${avgTimeToReward}d avg to reward` : 'all-time'}
        href="/payouts"
        tone="success"
      />
    </section>

    <WeeklyRecap submissions={$submissionStore} sessions={$sessionStore} />

    {#if showForm}
      <section class="hf-card p-4">
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <h2 class="text-lg font-semibold text-zinc-100">
            {#if fromNoteId}
              New Submission
            {:else if editing}
              Edit Submission
            {:else}
              New Submission
            {/if}
          </h2>
          {#if fromNoteId}
            <span class="inline-flex items-center gap-1.5 rounded-md border border-primary-500/30 bg-primary-500/10 px-2 py-0.5 text-xs font-medium text-primary-200">
              Promoted from note
            </span>
          {/if}
        </div>
        <SubmissionForm
          submission={editing}
          targets={$targetStore}
          submitLabel={editing && !fromNoteId ? 'Save Changes' : 'Create Submission'}
          on:submit={saveSubmission}
          on:cancel={() => {
            showForm = false;
            editing = null;
            fromNoteId = '';
          }}
        />
      </section>
    {/if}

    <section class="hf-card space-y-4 p-4">
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_180px_220px]">
        <label class="block">
          <span class="hf-label">Search</span>
          <input bind:value={query} class="hf-input mt-2" placeholder="Title, vuln class, tag" />
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
            <option value="all">All severities</option>
            {#each severityOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>

        <label class="block">
          <span class="hf-label">Target</span>
          <select bind:value={targetFilter} class="hf-select mt-2">
            <option value="all">All targets</option>
            {#each $targetStore as target}
              <option value={target.id}>{target.name}</option>
            {/each}
          </select>
        </label>
      </div>
    </section>

    {#if filtered.length > 0}
      <section class="space-y-3">
        {#each filtered as submission (submission.id)}
          {@const target = targetMap.get(submission.targetId)}
          <article class="hf-card p-4">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div class="min-w-0 flex-1 space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="text-base font-semibold text-zinc-100">{submission.title}</h2>
                  <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium {statusClass(submission.status)}">
                    {statusLabel(submission.status)}
                  </span>
                  <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium {severityClass(submission.severity)}">
                    {submission.severity}
                  </span>
                  {#if submission.cvssScore != null}
                    <span class="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">
                      CVSS {submission.cvssScore.toFixed(1)}
                    </span>
                  {/if}
                </div>

                <div class="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                  <span class="inline-flex items-center gap-1.5">
                    <PlatformIcon platform={submission.platform} />
                  </span>
                  {#if target}
                    <a
                      href={`/targets/${target.id}`}
                      class="inline-flex items-center gap-1 text-zinc-300 hover:text-primary"
                    >
                      <TargetIcon size={12} aria-hidden="true" />
                      {target.name}
                    </a>
                  {/if}
                  {#if submission.vulnerabilityType}
                    <span>· {submission.vulnerabilityType}</span>
                  {/if}
                  <span class="inline-flex items-center gap-1">
                    <Clock size={12} aria-hidden="true" />
                    Submitted {formatDate(submission.submittedAt)}
                  </span>
                  {#if submission.bountyAmount}
                    <span class="inline-flex items-center gap-1 font-semibold text-green-400">
                      <DollarSign size={12} aria-hidden="true" />
                      {money(submission.bountyAmount)}
                    </span>
                  {/if}
                  <SlaIndicator {submission} />
                </div>

                {#if submission.notes}
                  <p class="text-sm text-zinc-400 line-clamp-2">{submission.notes}</p>
                {/if}

                {#if (submission.tags ?? []).length > 0}
                  <div class="flex flex-wrap gap-1">
                    {#each submission.tags ?? [] as tag}
                      <span class="rounded-md border border-zinc-700 bg-zinc-850 px-1.5 py-0.5 text-[11px] text-zinc-400">{tag}</span>
                    {/each}
                  </div>
                {/if}
              </div>

              <div class="flex shrink-0 items-center gap-1">
                {#if submission.reportUrl}
                  <a
                    class="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-700 hover:text-primary"
                    href={submission.reportUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open report"
                  >
                    <ExternalLink size={16} aria-hidden="true" />
                  </a>
                {/if}
                <button
                  type="button"
                  class="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-100"
                  aria-label="Edit"
                  on:click={() => startEdit(submission)}
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 transition hover:bg-red-500/10 hover:text-red-300"
                  aria-label="Delete"
                  on:click={() => deleteSubmission(submission)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          </article>
        {/each}
      </section>
    {:else}
      <section class="hf-card p-8 text-center">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-900 text-zinc-600">
          <Send size={28} aria-hidden="true" />
        </div>
        <h2 class="mt-4 text-lg font-semibold text-zinc-300">
          {#if $submissionStore.length === 0}No submissions yet{:else}No submissions match{/if}
        </h2>
        <p class="mt-2 text-sm text-zinc-500">
          {#if $submissionStore.length === 0}
            Track every report from draft through to bounty. Link payouts when they land.
          {:else}
            Adjust the filters above.
          {/if}
        </p>
        {#if $submissionStore.length === 0}
          <button type="button" class="mt-5 hf-button-primary" on:click={startCreate}>
            <Plus size={20} aria-hidden="true" />
            New Submission
          </button>
        {/if}
      </section>
    {/if}
  </div>
</main>
