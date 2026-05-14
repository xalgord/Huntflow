<script lang="ts">
  import EmptyState from '$lib/components/workspace/EmptyState.svelte';
  import MetricCard from '$lib/components/workspace/MetricCard.svelte';
  import SeverityBadge from '$lib/components/workspace/SeverityBadge.svelte';
  import StatusBadge from '$lib/components/workspace/StatusBadge.svelte';
  import {
    noteStore,
    payoutStore,
    reconAssetStore,
    sessionStore,
    submissionStore,
    targetStore,
    timerStore
  } from '$lib/stores';
  import type { Note, Payout, ReconAsset, Session, Submission, Target } from '$lib/types';
  import {
    assetStatusLabels,
    formatDuration,
    formatMoney,
    formatRelativeDate,
    formatTimer,
    platformLabels,
    priorityLabels,
    scopeStatusFor,
    statusTone,
    targetStatusLabels
  } from '$lib/utils/workspace';
  import {
    BarChart3,
    CircleDollarSign,
    Clock,
    FileText,
    FolderKanban,
    Play,
    Send,
    ShieldAlert,
    Target as TargetIcon,
    Timer
  } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let loaded = false;

  onMount(async () => {
    await Promise.all([
      targetStore.load(),
      reconAssetStore.load(),
      sessionStore.load(),
      noteStore.load(),
      submissionStore.load(),
      payoutStore.load()
    ]);
    loaded = true;
  });

  function weekSeconds(sessions: Session[]): number {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    return sessions
      .filter((session) => session.status === 'completed' && session.startedAt >= start.getTime())
      .reduce((sum, session) => sum + session.durationActual, 0);
  }

  function programFor(id: string): Target | undefined {
    return $targetStore.find((program) => program.id === id);
  }

  function noteExcerpt(note: Note): string {
    return note.content
      .replace(/```[\s\S]*?```/g, ' code ')
      .replace(/[#>*_`[\]()]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
  }

  function unresolved(submission: Submission): boolean {
    return !['duplicate', 'informational', 'not-applicable', 'resolved', 'rewarded', 'closed'].includes(
      submission.status
    );
  }

  $: activePrograms = $targetStore
    .filter((program) => !['archived', 'closed'].includes(program.status))
    .sort((a, b) => (b.lastSessionAt ?? b.updatedAt) - (a.lastSessionAt ?? a.updatedAt));
  $: openTargets = $reconAssetStore
    .filter((asset) => scopeStatusFor(asset) !== 'out-of-scope' && !['tested', 'safe', 'dead'].includes(asset.status))
    .sort((a, b) => {
      const aPriority = a.priority ?? programFor(a.targetId)?.priority ?? 3;
      const bPriority = b.priority ?? programFor(b.targetId)?.priority ?? 3;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return b.updatedAt - a.updatedAt;
    });
  $: recentNotes = [...$noteStore].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
  $: openFindings = $submissionStore.filter(unresolved).sort((a, b) => b.updatedAt - a.updatedAt);
  $: draftReports = $submissionStore.filter((submission) => submission.status === 'draft');
  $: submittedReports = $submissionStore.filter((submission) => submission.status !== 'draft');
  $: acceptedReports = $submissionStore.filter((submission) =>
    ['accepted', 'resolved', 'rewarded'].includes(submission.status)
  );
  $: paidPayouts = $payoutStore.filter((payout) => payout.status === 'paid');
  $: pendingPayouts = $payoutStore.filter((payout) => payout.status !== 'paid');
  $: totalPayout = paidPayouts.reduce((sum, payout) => sum + payout.amount, 0);
  $: pendingPayout = pendingPayouts.reduce((sum, payout) => sum + payout.amount, 0);
  $: activeSession = $timerStore.sessionId
    ? $sessionStore.find((session) => session.id === $timerStore.sessionId)
    : undefined;
  $: activeSessionProgram = activeSession ? programFor(activeSession.targetId) : undefined;
  $: timerRunning = $timerStore.status === 'running' || $timerStore.status === 'paused';
  $: recentPayouts = [...$payoutStore].sort((a, b) => b.date - a.date).slice(0, 4);
  $: statusSummary = [
    ['Draft', draftReports.length],
    ['Submitted', $submissionStore.filter((submission) => submission.status === 'submitted').length],
    ['Triaged', $submissionStore.filter((submission) => submission.status === 'triaged').length],
    ['Accepted', acceptedReports.length],
    ['Duplicate/N/A', $submissionStore.filter((submission) => ['duplicate', 'not-applicable'].includes(submission.status)).length]
  ];
</script>

<svelte:head>
  <title>Dashboard | HuntFlow bug bounty command center</title>
  <meta
    name="description"
    content="HuntFlow dashboard for local-first bug bounty programs, targets, sessions, findings, reports, payouts, and hunting progress."
  />
</svelte:head>

<main class="hf-page">
  <div class="hf-page-inner">
    <header class="hf-page-header">
      <div>
        <p class="hf-eyebrow">Bug bounty command center</p>
        <h1 class="hf-title">What needs attention today</h1>
        <p class="hf-description">
          Local programs, scope, session history, evidence notes, submissions, and payouts in one workspace.
        </p>
      </div>
      <div class="flex flex-wrap gap-3">
        <a href="/notes/new" class="hf-button-secondary">
          <FileText size={17} aria-hidden="true" />
          Capture Note
        </a>
        <a href="/timer" class="hf-button-primary">
          <Play size={17} aria-hidden="true" />
          New Session
        </a>
      </div>
    </header>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={FolderKanban} label="Active programs" value={String(activePrograms.length)} detail="Watching, hunting, or paused" href="/programs" />
      <MetricCard icon={TargetIcon} label="Open targets" value={String(openTargets.length)} detail="In-scope assets needing work" href="/targets" />
      <MetricCard icon={Clock} label="Hunt hours this week" value={formatDuration(weekSeconds($sessionStore))} detail="Completed focused sessions" href="/analytics" />
      <MetricCard icon={FileText} label="Reports drafted" value={String(draftReports.length)} detail="Structured drafts in progress" href="/reports" />
      <MetricCard icon={Send} label="Submitted reports" value={String(submittedReports.length)} detail="Sent to programs" href="/reports" />
      <MetricCard icon={ShieldAlert} label="Accepted reports" value={String(acceptedReports.length)} detail="Accepted, resolved, or paid" href="/findings" tone="success" />
      <MetricCard icon={CircleDollarSign} label="Total payout" value={formatMoney(totalPayout)} detail={`${paidPayouts.length} paid payout${paidPayouts.length === 1 ? '' : 's'}`} href="/payouts" tone="success" />
      <MetricCard icon={CircleDollarSign} label="Pending payout" value={formatMoney(pendingPayout)} detail="Pending or triaged" href="/payouts" tone="warning" />
    </section>

    <section class="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
      <article class="hf-card p-5">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-xs font-medium text-zinc-500">Active hunt session</p>
            <h2 class="mt-1 text-xl font-semibold text-zinc-50">
              {#if timerRunning}
                {activeSessionProgram?.name ?? 'Focused hunt in progress'}
              {:else}
                Ready for the next focused session
              {/if}
            </h2>
          </div>
          <a href="/timer" class="hf-button-primary">
            <Timer size={17} aria-hidden="true" />
            {timerRunning ? 'Open Timer' : 'Start Session'}
          </a>
        </div>

        <div class="mt-5 grid gap-3 sm:grid-cols-3">
          <div class="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <p class="text-xs text-zinc-500">Timer</p>
            <p class="mt-2 font-mono text-3xl font-semibold text-zinc-50">
              {timerRunning ? formatTimer($timerStore.remainingMs) : '00:00'}
            </p>
          </div>
          <div class="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <p class="text-xs text-zinc-500">Current program</p>
            <p class="mt-2 truncate text-sm font-medium text-zinc-100">{activeSessionProgram?.name ?? 'None selected'}</p>
            <p class="mt-1 text-xs text-zinc-500">{activeSessionProgram ? platformLabels[activeSessionProgram.platform] : 'Pick a program in Sessions'}</p>
          </div>
          <div class="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <p class="text-xs text-zinc-500">Session state</p>
            <p class="mt-2 text-sm font-medium text-zinc-100">{$timerStore.status}</p>
            <p class="mt-1 text-xs text-zinc-500">Stored locally in this browser</p>
          </div>
        </div>
      </article>

      <article class="hf-card p-5">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-xs font-medium text-zinc-500">Submission status summary</p>
            <h2 class="mt-1 text-lg font-semibold text-zinc-50">Report pipeline</h2>
          </div>
          <BarChart3 size={18} class="text-zinc-500" aria-hidden="true" />
        </div>
        <div class="mt-4 space-y-3">
          {#each statusSummary as item}
            {@const [label, count] = item}
            <a href="/reports" class="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm transition hover:border-zinc-700">
              <span class="text-zinc-400">{label}</span>
              <span class="font-mono text-zinc-100">{count}</span>
            </a>
          {/each}
        </div>
      </article>
    </section>

    <section class="grid gap-4 xl:grid-cols-3">
      <article class="hf-card p-5">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-zinc-100">Programs currently hunted</h2>
          <a href="/programs" class="text-xs font-medium text-zinc-500 hover:text-zinc-200">View all</a>
        </div>
        {#if activePrograms.length > 0}
          <div class="space-y-3">
            {#each activePrograms.slice(0, 4) as program}
              <a href={`/programs/${program.id}`} class="block rounded-xl border border-zinc-800 bg-zinc-950 p-3 transition hover:border-zinc-700">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-zinc-100">{program.name}</p>
                    <p class="mt-1 text-xs text-zinc-500">{platformLabels[program.platform]} · Last activity {formatRelativeDate(program.lastSessionAt ?? program.updatedAt)}</p>
                  </div>
                  <StatusBadge label={targetStatusLabels[program.status]} tone={statusTone(program.status)} />
                </div>
              </a>
            {/each}
          </div>
        {:else if loaded}
          <p class="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">No active programs. Add your first HackerOne, Bugcrowd, Intigriti, or private program.</p>
        {/if}
      </article>

      <article class="hf-card p-5">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-zinc-100">Targets needing attention</h2>
          <a href="/targets" class="text-xs font-medium text-zinc-500 hover:text-zinc-200">View all</a>
        </div>
        {#if openTargets.length > 0}
          <div class="space-y-3">
            {#each openTargets.slice(0, 4) as asset}
              <a href={`/targets?asset=${asset.id}`} class="block rounded-xl border border-zinc-800 bg-zinc-950 p-3 transition hover:border-zinc-700">
                <p class="truncate font-mono text-sm text-zinc-100">{asset.url ?? asset.hostname}</p>
                <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span>{programFor(asset.targetId)?.name ?? 'Unassigned'}</span>
                  <StatusBadge label={priorityLabels[asset.priority ?? programFor(asset.targetId)?.priority ?? 3]} />
                  <StatusBadge label={assetStatusLabels[asset.status]} tone={statusTone(asset.status)} />
                </div>
              </a>
            {/each}
          </div>
        {:else if loaded}
          <p class="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">No target assets need attention. Add in-scope assets manually or paste scope from a program page.</p>
        {/if}
      </article>

      <article class="hf-card p-5">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-zinc-100">Recent payouts</h2>
          <a href="/payouts" class="text-xs font-medium text-zinc-500 hover:text-zinc-200">View all</a>
        </div>
        {#if recentPayouts.length > 0}
          <div class="space-y-3">
            {#each recentPayouts as payout}
              <a href="/payouts" class="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3 transition hover:border-zinc-700">
                <span class="min-w-0">
                  <span class="block truncate text-sm font-medium text-zinc-100">{payout.program}</span>
                  <span class="mt-1 block text-xs text-zinc-500">{platformLabels[payout.platform]} · {payout.status}</span>
                </span>
                <span class="font-mono text-sm text-zinc-100">{formatMoney(payout.amount)}</span>
              </a>
            {/each}
          </div>
        {:else if loaded}
          <p class="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">No payouts yet. Accepted reports and rewards will show here.</p>
        {/if}
      </article>
    </section>

    <section class="grid gap-4 xl:grid-cols-3">
      <article class="hf-card p-5">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-zinc-100">Recent notes</h2>
          <a href="/notes" class="text-xs font-medium text-zinc-500 hover:text-zinc-200">View all</a>
        </div>
        {#if recentNotes.length > 0}
          <div class="space-y-3">
            {#each recentNotes as note}
              <a href={`/notes/${note.id}`} class="block rounded-xl border border-zinc-800 bg-zinc-950 p-3 transition hover:border-zinc-700">
                <p class="truncate text-sm font-medium text-zinc-100">{note.title || 'Untitled note'}</p>
                <p class="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{noteExcerpt(note) || 'No content yet'}</p>
              </a>
            {/each}
          </div>
        {:else if loaded}
          <p class="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">No notes yet. Capture recon notes, payload observations, and report snippets as you hunt.</p>
        {/if}
      </article>

      <article class="hf-card p-5">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-zinc-100">Open findings</h2>
          <a href="/findings" class="text-xs font-medium text-zinc-500 hover:text-zinc-200">View all</a>
        </div>
        {#if openFindings.length > 0}
          <div class="space-y-3">
            {#each openFindings.slice(0, 4) as finding}
              <a href={`/findings?id=${finding.id}`} class="block rounded-xl border border-zinc-800 bg-zinc-950 p-3 transition hover:border-zinc-700">
                <div class="flex items-start justify-between gap-3">
                  <p class="min-w-0 truncate text-sm font-medium text-zinc-100">{finding.title}</p>
                  <SeverityBadge severity={finding.severity} />
                </div>
                <p class="mt-2 text-xs text-zinc-500">{programFor(finding.targetId)?.name ?? 'Missing program'} · {finding.status}</p>
              </a>
            {/each}
          </div>
        {:else if loaded}
          <p class="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">No findings yet. Capture leads before turning them into report-ready submissions.</p>
        {/if}
      </article>

      <article class="hf-card p-5">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-zinc-100">Draft reports</h2>
          <a href="/reports" class="text-xs font-medium text-zinc-500 hover:text-zinc-200">View all</a>
        </div>
        {#if draftReports.length > 0}
          <div class="space-y-3">
            {#each draftReports.slice(0, 4) as report}
              <a href={`/reports?id=${report.id}`} class="block rounded-xl border border-zinc-800 bg-zinc-950 p-3 transition hover:border-zinc-700">
                <p class="truncate text-sm font-medium text-zinc-100">{report.title}</p>
                <p class="mt-1 text-xs text-zinc-500">{programFor(report.targetId)?.name ?? 'Missing program'} · {report.vulnerabilityType ?? 'Generic report'}</p>
              </a>
            {/each}
          </div>
        {:else if loaded}
          <p class="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">No reports yet. Link a confirmed finding and build a structured draft.</p>
        {/if}
      </article>
    </section>

    {#if loaded && $targetStore.length === 0 && $reconAssetStore.length === 0 && $noteStore.length === 0}
      <EmptyState
        icon={FolderKanban}
        title="Start by adding a program"
        description="HuntFlow stays local to this browser. Add a program, paste scope, create target assets, and start a focused hunt session."
        actionLabel="Add Program"
        href="/programs?new=1"
      />
    {/if}
  </div>
</main>
